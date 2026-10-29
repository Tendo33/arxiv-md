// 共享 HTTP 工具：带超时的 fetch（ctx.fetch 可注入，测试用）
import { fromFetchFailure } from './errors.js';

export const DEFAULT_REQUEST_TIMEOUT = 30000;

/** 合并多个 AbortSignal：有 AbortSignal.any（Chrome 116+ / Firefox 124+，manifest 最低 Firefox 140）就用，否则手动转发（保留兜底） */
export function anySignal(signals) {
  const list = signals.filter(Boolean);
  if (list.length <= 1) return list[0] || null;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') return AbortSignal.any(list);
  const c = new AbortController();
  for (const s of list) {
    if (s.aborted) { c.abort(s.reason); break; }
    s.addEventListener('abort', () => c.abort(s.reason), { once: true });
  }
  return c.signal;
}

/** 调用方已中止（删除任务等）时抛出的错误；runner 据此当作「已删除」，不记为失败 */
export function abortedByCaller(signal) {
  const e = new Error('aborted by caller'); e.name = 'AbortError'; e.callerAborted = true; e.reason = signal && signal.reason; return e;
}

// 审查 P2-3：不再覆盖调用方的 signal（options.signal / ctx.signal），和超时合并
export async function fetchWithTimeout(url, options = {}, { ctx = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT, provider } = {}) {
  const f = ctx.fetch || globalThis.fetch;
  const callers = [options.signal, ctx.signal].filter(Boolean);
  if (callers.some((s) => s.aborted)) throw abortedByCaller(callers.find((s) => s.aborted));
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const signal = anySignal([...callers, controller && controller.signal]);
  try {
    return await f(url, signal ? { ...options, signal } : options);
  } catch (e) {
    const hit = callers.find((s) => s.aborted);
    if (hit) throw abortedByCaller(hit);
    throw fromFetchFailure(e, provider);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function hostOf(pattern) {
  return String(pattern).replace(/^[a-z*]+:\/\//, '').replace(/\/.*$/, '');
}
