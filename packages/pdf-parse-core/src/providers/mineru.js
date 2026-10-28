// R4-04：MinerU provider（吸收 mineru-client + mineru-response），请求体和行为与 1.1.12 相同
import { defineProvider } from '../provider.js';
import { ParseError, classifyHttpError, readErrorResponse, isParseError, fromFetchFailure } from '../errors.js';
import { fetchWithTimeout } from '../http.js';
import { isMinerUSuccessCode, readMinerUTaskStatus } from './mineru-response.js';

export const MINERU_TASK_URL = 'https://mineru.net/api/v4/extract/task';
const ID = 'mineru';

// MinerU 业务码：A0202/A0211 = token 错误/过期；-60005 = 文件过大；-60006 = 页数超限；-60002/-60003 = 格式/读取失败
const AUTH_CODES = new Set(['A0202', 'A0211']);
const TOO_LARGE_CODES = new Set(['-60005', '-60006']);
const UNSUPPORTED_CODES = new Set(['-60002', '-60003']);

function mapBusinessCode(json, httpStatus = null) {
  const c = String(json && json.code);
  const base = { provider: ID, httpStatus, raw: json, message: (json && json.msg) || undefined };
  if (AUTH_CODES.has(c)) return new ParseError('AUTH_INVALID', base);
  if (TOO_LARGE_CODES.has(c)) return new ParseError('TOO_LARGE', base);
  if (UNSUPPORTED_CODES.has(c)) return new ParseError('FILE_UNSUPPORTED', base);
  return new ParseError('PROVIDER_FAILED', { ...base, reason: (json && json.msg) || `code ${c}` });
}

export function mapMinerUError(err) {
  if (isParseError(err)) return err;
  if (err && typeof err.status === 'number') {
    // 旧行为：401 → 没 token / token 无效；429 → 额度用完（MinerU 不给 Retry-After）
    if (err.status === 401) return new ParseError('AUTH_INVALID', { provider: ID, httpStatus: 401, raw: err.json ?? err.bodyText ?? null });
    if (err.status === 429) return new ParseError('QUOTA_EXCEEDED', { provider: ID, httpStatus: 429, raw: err.json ?? null });
    if (err.json && err.json.code != null && !isMinerUSuccessCode(err.json.code)) {
      const e = mapBusinessCode(err.json, err.status);
      if (e.code !== 'PROVIDER_FAILED') return e;
    }
    return classifyHttpError(err, ID);
  }
  if (err && err.code != null && 'msg' in err) return mapBusinessCode(err);
  return fromFetchFailure(err, ID);
}

async function request(url, init, token, ctx) {
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  }, { ctx, provider: ID, timeoutMs: ctx.requestTimeoutMs });
  if (!res.ok) throw mapMinerUError(await readErrorResponse(res));
  const json = await res.json();
  if (!isMinerUSuccessCode(json.code)) throw mapBusinessCode(json, res.status);
  return json;
}

export const mineruProvider = defineProvider({
  id: ID,
  label: 'MinerU',
  hosts: ['https://mineru.net/*', 'https://cdn-mineru.openxlab.org.cn/*'],
  credentialFields: [{ key: 'token', label: 'API Token', secret: true }],
  keyUrl: 'https://mineru.net/apiManage/token',
  dataHost: 'mineru.net',
  mode: 'async',
  input: 'url',
  cost: 'free',
  output: 'zip', // 交付 MinerU 原始 ZIP（默认不走统一整理流程）
  timeoutMs: 5 * 60 * 1000, // 2s × 150 次，与 1.1.12 相同
  pollIntervalMs: 2000,

  async submit(input, creds, ctx = {}) {
    if (!creds || !creds.token) throw new ParseError('AUTH_INVALID', { provider: ID });
    const json = await request(MINERU_TASK_URL, {
      method: 'POST',
      body: JSON.stringify({
        url: input.url,
        model_version: (input.options && input.options.modelVersion) || 'vlm',
        language: 'en', // arXiv 论文为英文，明确指定避免默认 'ch' 影响 OCR
        ...(input.dataId && { data_id: input.dataId }),
      }),
    }, creds.token, ctx);
    const jobId = json.data && json.data.task_id;
    if (!jobId) throw new ParseError('PROVIDER_FAILED', { provider: ID, raw: json, reason: 'missing task_id' });
    return { jobId };
  },

  async poll(jobId, creds, ctx = {}) {
    if (!creds || !creds.token) throw new ParseError('AUTH_INVALID', { provider: ID });
    const json = await request(`${MINERU_TASK_URL}/${jobId}`, { method: 'GET' }, creds.token, ctx);
    const s = readMinerUTaskStatus(json.data || {});
    const progress = s.progress && s.progress.total_pages > 0
      ? { done: s.progress.extracted_pages || 0, total: s.progress.total_pages } : null;
    if (s.state === 'done') {
      if (!s.zipUrl) throw new ParseError('PROVIDER_FAILED', { provider: ID, raw: json, reason: 'Completed task has no result URL' });
      return { state: 'done', progress, result: { zipUrl: s.zipUrl }, raw: s };
    }
    if (s.state === 'failed') {
      return { state: 'failed', progress, error: s.error || 'Task failed', raw: s };
    }
    // pending / running / converting(格式导出) 都算进行中
    return { state: s.state === 'pending' || s.state === 'waiting-file' ? 'pending' : 'running', progress, raw: s };
  },

  async fetchResult(result) {
    return { zipUrl: result.zipUrl };
  },

  mapError: mapMinerUError,

  /** 测试连接：GET 一个随机 task_id，绝不提交任务。401=Key 无效；404/业务码非鉴权类=Key 有效 */
  async testConnection(creds, ctx = {}) {
    if (!creds || !creds.token) return { ok: false, error: new ParseError('AUTH_INVALID', { provider: ID }) };
    const fake = `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
    try {
      const res = await fetchWithTimeout(`${MINERU_TASK_URL}/${fake}`, {
        method: 'GET', headers: { Authorization: `Bearer ${creds.token}` },
      }, { ctx, provider: ID, timeoutMs: 15000 });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (AUTH_CODES.has(String(json.code))) return { ok: false, error: mapBusinessCode(json, res.status) };
        return { ok: true };
      }
      if (res.status === 404 || res.status === 400) return { ok: true };
      const e = mapMinerUError(await readErrorResponse(res));
      if (e.code === 'AUTH_INVALID' || e.code === 'QUOTA_EXCEEDED' || e.code === 'RATE_LIMITED') return { ok: false, error: e };
      return e.httpStatus && e.httpStatus < 500 ? { ok: true } : { ok: false, error: e };
    } catch (e) {
      return { ok: false, error: mapMinerUError(e) };
    }
  },
});

export default mineruProvider;
