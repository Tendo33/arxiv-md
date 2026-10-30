// DNR 规则，仅作用于 paddleocr.aistudio-app.com，用于去掉 Origin 头：星河网关对带 chrome-extension:// Origin 的请求返回空 body 403。
// 1.2.2 起 declarativeNetRequestWithHostAccess 和星河域名都在 manifest 里安装时授予，这里直接认为权限已在；
// 规则只删本扩展自己发出的请求的 Origin 头，不影响其他网站和其他扩展。
import logger from '@utils/logger';
import { ParseError, ERROR_REASONS } from '@pdf-core/errors';

export const PADDLE_ORIGIN_RULE_ID = 4001;
export const DNR_PERMISSION = 'declarativeNetRequestWithHostAccess';
/** R5-01：提交前等规则就绪的上限；DNR 调用可能永不 settle */
export const DNR_READY_TIMEOUT_MS = 5000;
// R5-02：DNR 命名空间不可用时调用会抛这个错
const NOT_AVAILABLE = /not available in this context|is not a function|Cannot read propert/i;

/**
 * initiatorDomains 要的是扩展页面的 host：Chrome 里就是扩展 id；Firefox 里 runtime.id 是 arxiv-md@tendo33
 * （不是合法域名，updateDynamicRules 直接报 Invalid domain，规则装不上），要用 moz-extension://<uuid>/ 的 uuid
 */
export function extensionHost(c = globalThis.chrome) {
  const rt = c && c.runtime;
  if (!rt) return undefined;
  try { if (typeof rt.getURL === 'function') { const h = new URL(rt.getURL('/')).hostname; if (h) return h; } } catch { /* 回退到 id */ }
  return rt.id;
}

export function buildPaddleOriginRule(extensionId) {
  return {
    id: PADDLE_ORIGIN_RULE_ID,
    priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'remove' }] },
    condition: {
      requestDomains: ['paddleocr.aistudio-app.com'],
      ...(extensionId ? { initiatorDomains: [extensionId] } : {}),
      resourceTypes: ['xmlhttprequest', 'other'],
    },
  };
}

/** 装规则（先删再加，幂等）。DNR 权限在 manifest 里安装时授予，不再查 permissions */
export async function syncPaddleOriginRule(c = globalThis.chrome) {
  try {
    const dnr = c && c.declarativeNetRequest;
    if (!dnr) return false;
    await dnr.updateDynamicRules({ removeRuleIds: [PADDLE_ORIGIN_RULE_ID], addRules: [buildPaddleOriginRule(extensionHost(c))] });
    return true;
  } catch (e) {
    // R5-02：DNR 不可用（被浏览器策略禁用等）只记 debug，提交前由 requirePaddleOriginRule 报 dnr_not_ready
    if (NOT_AVAILABLE.test(String((e && e.message) || e))) { logger.debug('syncPaddleOriginRule: DNR not available'); return false; }
    logger.warn('syncPaddleOriginRule failed:', e);
    return false;
  }
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`DNR not ready after ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

const hasRule = (rules) => (rules || []).some((r) => r && r.id === PADDLE_ORIGIN_RULE_ID);

/**
 * R5-01：PaddleOCR 提交前必须确认规则 4001 已装上（否则星河网关回空 body 403）。
 * 已装 → 直接过；没装 → 重装（remove+add）后再查一次，最多 attempts 轮；
 * 整体 timeoutMs 内没就绪（含 DNR 调用挂起、抛 "not available in this context"）→ 抛
 * PERMISSION_MISSING(reason=dnr_not_ready)，任务失败并提示重新初始化或重启浏览器，不会无限期卡在「等待处理」。
 */
export async function requirePaddleOriginRule(c = globalThis.chrome, { timeoutMs = DNR_READY_TIMEOUT_MS, attempts = 3, retryDelayMs = 300, sleep } = {}) {
  const wait = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const notReady = (raw) => new ParseError('PERMISSION_MISSING', { provider: 'paddleocr', reason: ERROR_REASONS.DNR_NOT_READY, raw });
  const attempt = async () => {
    let last = 'rule missing';
    for (let i = 0; i < attempts; i++) {
      const dnr = c && c.declarativeNetRequest; // 每轮现取
      try {
        if (dnr && dnr.getDynamicRules) {
          if (hasRule(await dnr.getDynamicRules())) return true;
          await dnr.updateDynamicRules({ removeRuleIds: [PADDLE_ORIGIN_RULE_ID], addRules: [buildPaddleOriginRule(extensionHost(c))] });
          if (hasRule(await dnr.getDynamicRules())) return true;
        } else {
          last = 'dnr api missing';
        }
      } catch (e) {
        last = String((e && e.message) || e);
      }
      if (i < attempts - 1) await wait(retryDelayMs);
    }
    throw notReady(last);
  };
  try {
    return await withTimeout(attempt(), timeoutMs);
  } catch (e) {
    const err = e instanceof ParseError ? e : notReady(String((e && e.message) || e));
    logger.warn(`requirePaddleOriginRule: ${err.reason} (${typeof err.raw === 'string' ? err.raw : ''})`);
    throw err;
  }
}

/**
 * R4-02：在 background 里确认规则状态（幂等）。规则已在 → 什么都不做；不在（之前装失败）→ 重装。
 * 只在 background 调用，popup/options 永远不碰 updateDynamicRules。
 */
export async function ensurePaddleOriginRule(c = globalThis.chrome) {
  try {
    const dnr = c && c.declarativeNetRequest;
    if (dnr && dnr.getDynamicRules) {
      const rules = await dnr.getDynamicRules();
      if (hasRule(rules)) return true;
    }
    return await syncPaddleOriginRule(c);
  } catch (e) {
    logger.warn('ensurePaddleOriginRule failed:', e);
    return false;
  }
}

/** 后台启动时装一次规则（权限安装时已授予，不再监听权限变化事件） */
export function installPaddleOriginRule(c = globalThis.chrome) {
  return syncPaddleOriginRule(c);
}
