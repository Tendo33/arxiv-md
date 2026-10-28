// DNR（Simon 22:40 已批）：星河网关对带 chrome-extension:// Origin 的请求返回空 body 403。
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

export function installPaddleOriginRuleListeners(c = globalThis.chrome) {
  if (!c || !c.permissions || !c.permissions.onAdded) return;
  const onChange = () => { syncPaddleOriginRule(c); };
  c.permissions.onAdded.addListener(onChange);
  c.permissions.onRemoved.addListener(onChange);
  syncPaddleOriginRule(c);
}
