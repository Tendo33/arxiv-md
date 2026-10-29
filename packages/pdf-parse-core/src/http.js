// 共享 HTTP 工具：带超时的 fetch（ctx.fetch 可注入，测试用）
import { fromFetchFailure } from './errors.js';

export const DEFAULT_REQUEST_TIMEOUT = 30000;

export async function fetchWithTimeout(url, options = {}, { ctx = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT, provider } = {}) {
  const f = ctx.fetch || globalThis.fetch;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await f(url, controller ? { ...options, signal: controller.signal } : options);
  } catch (e) {
    throw fromFetchFailure(e, provider);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function hostOf(pattern) {
  return String(pattern).replace(/^[a-z*]+:\/\//, '').replace(/\/.*$/, '');
}
