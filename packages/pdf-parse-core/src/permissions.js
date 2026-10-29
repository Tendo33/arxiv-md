// R4-08：按需申请 provider 的域名权限。core 不碰全局 chrome，调用方传入 permissions API（chrome.permissions / browser.permissions）。
// request() 只能在用户手势（设置页按钮 click / 下拉框 change）里调用，Firefox 强制要求。
import { ParseError } from './errors.js';

/**
 * provider 需要的权限。permissionMode='install' 表示域名已在 manifest host_permissions 里（MinerU，方案 A），
 * 不需要申请，也不提供撤销。
 * @param {import('./provider').Provider} provider
 */
export function permissionsFor(provider) {
  if (!provider || provider.permissionMode === 'install') return { origins: [], permissions: [] };
  return { origins: [...(provider.hosts || [])], permissions: [...(provider.optionalPermissions || [])] };
}

const isEmpty = (q) => !q.origins.length && !q.permissions.length;
const compact = (q) => ({ ...(q.origins.length ? { origins: q.origins } : {}), ...(q.permissions.length ? { permissions: q.permissions } : {}) });

/** @returns {Promise<boolean>} */
export async function hasProviderPermission(api, provider) {
  const q = permissionsFor(provider);
  if (isEmpty(q)) return true;
  try { return !!(await api.contains(compact(q))); } catch { return false; }
}

/** 必须在用户手势里调用。用户拒绝 → false（调用方回退下拉框并提示 PERMISSION_MISSING） */
export async function requestProviderPermission(api, provider) {
  const q = permissionsFor(provider);
  if (isEmpty(q)) return true;
  try { return !!(await api.request(compact(q))); } catch { return false; }
}

/** 撤销（切换后端后对旧后端显示“撤销”按钮）。install 模式的 provider 不可撤销 */
export async function removeProviderPermission(api, provider) {
  const q = permissionsFor(provider);
  if (isEmpty(q)) return false;
  try { return !!(await api.remove(compact(q))); } catch { return false; }
}

export function canRevoke(provider) {
  return !isEmpty(permissionsFor(provider));
}

/** 转换前检查：缺权限 → 抛 PERMISSION_MISSING（host 填第一个域名），调用方不得发任何请求 */
export async function ensureProviderPermission(api, provider) {
  if (await hasProviderPermission(api, provider)) return;
  // 指出第一个真正缺的域名（老用户只授权过星河域名、没授权结果域名时，不能误报星河）
  const origins = permissionsFor(provider).origins;
  let missing = origins[0] || '';
  for (const o of origins) {
    let ok = false;
    try { ok = !!(await api.contains({ origins: [o] })); } catch { ok = false; }
    if (!ok) { missing = o; break; }
  }
  const host = missing.replace(/^https?:\/\//, '').replace(/\/\*$/, '');
  throw new ParseError('PERMISSION_MISSING', { provider: provider.id, host });
}
