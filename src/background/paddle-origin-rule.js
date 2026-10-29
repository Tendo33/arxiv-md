// DNR 可选权限，仅作用于 paddleocr.aistudio-app.com，用于去掉 Origin 头：星河网关对带 chrome-extension:// Origin 的请求返回空 body 403。
// 只在用户授予可选权限 declarativeNetRequestWithHostAccess 后生效；规则只作用于 paddleocr.aistudio-app.com，
// 只删本扩展自己发出的请求的 Origin 头，不影响其他网站和其他扩展。
import logger from '@utils/logger';

export const PADDLE_ORIGIN_RULE_ID = 4001;
export const DNR_PERMISSION = 'declarativeNetRequestWithHostAccess';

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

/** 有权限 → 装规则；没权限 → 确保规则不存在。幂等 */
export async function syncPaddleOriginRule(c = globalThis.chrome) {
  try {
    if (!c || !c.permissions) return false;
    const granted = await c.permissions.contains({ permissions: [DNR_PERMISSION] });
    const dnr = c.declarativeNetRequest;
    if (!dnr) return false;
    await dnr.updateDynamicRules({
      removeRuleIds: [PADDLE_ORIGIN_RULE_ID],
      ...(granted ? { addRules: [buildPaddleOriginRule(c.runtime && c.runtime.id)] } : {}),
    });
    return granted;
  } catch (e) {
    logger.warn('syncPaddleOriginRule failed:', e);
    return false;
  }
}

/**
 * R4-02：提交前在 background 里确认规则状态（幂等）。
 * 有权限且规则已在 → 什么都不做；有权限但规则不在（授权后 SW 没收到事件 / 之前装失败）→ 重装；
 * 没权限 → 交给 sync 确保规则不存在。只在 background 调用，popup/options 永远不碰 updateDynamicRules。
 * 每次都从参数（默认 globalThis.chrome）现取 declarativeNetRequest：刚授权时命名空间可能才出现。
 */
export async function ensurePaddleOriginRule(c = globalThis.chrome) {
  try {
    if (!c || !c.permissions) return false;
    const granted = await c.permissions.contains({ permissions: [DNR_PERMISSION] });
    const dnr = c.declarativeNetRequest;
    if (granted && dnr && dnr.getDynamicRules) {
      const rules = await dnr.getDynamicRules();
      if ((rules || []).some((r) => r && r.id === PADDLE_ORIGIN_RULE_ID)) return true;
    }
    return await syncPaddleOriginRule(c);
  } catch (e) {
    logger.warn('ensurePaddleOriginRule failed:', e);
    return false;
  }
}

/** 只处理和 DNR 权限有关的变化；onAdded 装规则，onRemoved 删规则 */
const touchesDnr = (p) => !p || !p.permissions || p.permissions.includes(DNR_PERMISSION);

export function installPaddleOriginRuleListeners(c = globalThis.chrome) {
  if (!c || !c.permissions || !c.permissions.onAdded) return;
  c.permissions.onAdded.addListener((p) => { if (touchesDnr(p)) syncPaddleOriginRule(c); });
  c.permissions.onRemoved.addListener((p) => {
    if (!touchesDnr(p)) return;
    const dnr = c.declarativeNetRequest;
    // 权限已撤销时 contains=false，sync 会只做 remove；命名空间若已消失，规则随权限一并失效
    if (dnr) syncPaddleOriginRule(c);
  });
  syncPaddleOriginRule(c);
}
