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

/**
 * FF-01 方案 A：manifest 里已经是安装时必需的权限（Firefox 包的 declarativeNetRequestWithHostAccess）
 * 不再申请、不再撤销、contains 时也不再查。Chrome 包里 DNR 仍是可选权限，required 不含它，行为不变。
 * @param {any} api chrome.permissions / browser.permissions
 * @param {string[]} required manifest.permissions
 */
export function withRequiredPermissions(api, required = []) {
  if (!api || !required || !required.length) return api;
  const strip = (q = {}) => {
    const out = { ...q };
    if (Array.isArray(q.permissions)) {
      out.permissions = q.permissions.filter((p) => !required.includes(p));
      if (!out.permissions.length) delete out.permissions;
    }
    return out;
  };
  const empty = (q) => !(q.origins && q.origins.length) && !(q.permissions && q.permissions.length);
  // 不能用 Object.create(api) 再赋值：Firefox 的 API 命名空间属性是带 setter 的访问器，
  // 赋值会把真实的 chrome.permissions.request 换掉（实测 Firefox 159 报 too much recursion）。返回独立对象，只做转发
  return {
    contains: async (q) => { const s = strip(q); return empty(s) ? true : api.contains(s); },
    // request 必须同步转发，保住用户手势
    request: (q) => { const s = strip(q); return empty(s) ? Promise.resolve(true) : api.request(s); },
    remove: async (q) => { const s = strip(q); return empty(s) ? false : api.remove(s); },
    getAll: (...a) => api.getAll(...a),
    get onAdded() { return api.onAdded; },
    get onRemoved() { return api.onRemoved; },
  };
}

/** 从 runtime.getManifest() 取安装时必需的权限；拿不到就当空 */
export function requiredPermissionsOf(runtime) {
  try { return (runtime && runtime.getManifest && runtime.getManifest().permissions) || []; } catch { return []; }
}
