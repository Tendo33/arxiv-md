// MV3 SW 保活：Chrome 在「30 秒无活动」「单个 fetch 30 秒无响应」「单个请求超过 5 分钟」时回收 SW，
// 而「事件和扩展 API 调用会重置这些计时器」（developer.chrome.com service-workers/lifecycle）。
// 长上传期间每 20 秒调一次 runtime.getPlatformInfo()（无需任何权限），上传结束 / 失败 / 超时都在 finally 里停掉。
export const KEEPALIVE_INTERVAL_MS = 20 * 1000;

function defaultPing() {
  const rt = (globalThis.chrome && globalThis.chrome.runtime) || (globalThis.browser && globalThis.browser.runtime);
  if (!rt || typeof rt.getPlatformInfo !== 'function') return null;
  return () => { try { const p = rt.getPlatformInfo(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ } };
}

/** 在 fn() 执行期间定时 ping；没有扩展运行时（Node / 测试）时直接执行 */
export async function withKeepAlive(fn, { intervalMs = KEEPALIVE_INTERVAL_MS, ping = defaultPing() } = {}) {
  const timer = ping ? setInterval(ping, intervalMs) : null;
  try {
    return await fn();
  } finally {
    if (timer) clearInterval(timer);
  }
}
