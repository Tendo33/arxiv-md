/**
 * 判断一次失败是不是网络断开导致的（离线、DNS、连接被拒等）。
 * 只认浏览器 fetch 网络层失败的固定报错和 net::ERR_* 连接类错误，
 * 不再把任何带 "fetch" 字样的 TypeError 都当成断网。
 */
const FETCH_FAILURE = /^(?:TypeError:\s*)?(?:Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|Network request failed)$/i;
const NET_ERROR = /net::ERR_(?:INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|CONNECTION_[A-Z_]+|NETWORK_CHANGED|NETWORK_ACCESS_DENIED|ADDRESS_UNREACHABLE|TIMED_OUT)\b/;

export const NETWORK_OFFLINE_CODE = 'NETWORK_OFFLINE';

export function isNetworkError(error, nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (error && error.code === NETWORK_OFFLINE_CODE) return true;
  if (nav && nav.onLine === false) return true;
  if (!error) return false;
  const message = String(error.message ?? error).trim();
  return FETCH_FAILURE.test(message) || NET_ERROR.test(message);
}

/** 所有来源都因网络失败时抛出的错误，带 code 方便上层识别 */
export function offlineError(cause) {
  const error = new Error(cause?.message || 'Network unavailable');
  error.code = NETWORK_OFFLINE_CODE;
  error.cause = cause;
  return error;
}
