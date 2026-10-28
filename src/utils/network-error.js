/**
 * 判断一次失败是不是网络断开导致的（离线、DNS、连接被拒等）。
 * fetch 在网络层失败时抛 TypeError（Chrome: "Failed to fetch"）。
 */
export function isNetworkError(error, nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (nav && nav.onLine === false) return true;
  if (!error) return false;
  const message = String(error.message || error);
  return error.name === 'TypeError' && /fetch|network/i.test(message)
    || /Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i.test(message);
}
