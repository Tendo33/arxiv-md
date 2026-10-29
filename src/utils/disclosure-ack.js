// design-abs-buttons-2026-10-29 附录 C / C10：首次使用某个 PDF 解析后端前，必须先在设置页确认数据说明。
// 确认记录只存本机 chrome.storage.local（`disclosureAck.<provider>`），不跨设备同步。
export const DISCLOSURE_PROVIDERS = ['paddleocr', 'mineru'];
export const ackKey = (id) => `disclosureAck.${id}`;

const localArea = () => globalThis.chrome && chrome.storage && chrome.storage.local;

/** 需要确认的后端（本地服务等不在列表里的后端不需要） */
export const needsDisclosure = (id) => DISCLOSURE_PROVIDERS.includes(id);

/** @returns {Promise<boolean>} 是否已确认（不需要确认的后端视为已确认） */
export async function isDisclosureAcked(id, local = localArea()) {
  if (!needsDisclosure(id)) return true;
  if (!local) return false;
  try {
    const r = await local.get(ackKey(id));
    return !!(r && r[ackKey(id)]);
  } catch {
    return false;
  }
}

/** 写入确认记录。返回 set 的 Promise；调用方在同一个手势里接着申请权限时不要 await 它 */
export function ackDisclosure(id, local = localArea()) {
  if (!local || !needsDisclosure(id)) return Promise.resolve();
  return Promise.resolve(local.set({ [ackKey(id)]: Date.now() }));
}

/** 设置页 hash：`#disclose=<provider>` 打开该后端的数据说明 */
export const disclosureHash = (id) => `#disclose=${encodeURIComponent(id)}`;
export function parseDisclosureHash(hash) {
  const m = /(?:^#|&)disclose=([a-z0-9_-]+)/i.exec(String(hash || ''));
  return m && needsDisclosure(m[1]) ? m[1] : null;
}
