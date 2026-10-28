// R4-07：PaddleOCR provider（百度飞桨星河社区 API，异步任务）
// 只传 arXiv PDF 的 URL，不上传文件。
// TODO(R4-07/bcebos)：resultUrl 指向 *.bcebos.com，本轮不加该域名权限（管理员：只记 TODO 不合并）；
//   fetchResult 读取失败时报 PERMISSION_MISSING/NETWORK，由调用方提示。
import { defineProvider } from '../provider.js';
import { ParseError, classifyHttpError, readErrorResponse, isParseError, fromFetchFailure } from '../errors.js';
import { fetchWithTimeout } from '../http.js';

export const PADDLEOCR_BASE = 'https://paddleocr.aistudio-app.com';
export const PADDLEOCR_JOBS_URL = `${PADDLEOCR_BASE}/api/v2/ocr/jobs`;
export const PADDLEOCR_DEFAULT_MODEL = 'PaddleOCR-VL-1.5'; // 1.6 上线并经 QA 确认后再切
const ID = 'paddleocr';
const AUTH_TEXT = /unauthori[sz]ed|invalid (access )?token|token (expired|invalid)|鉴权|认证|令牌/i;

/** 星河业务码（HTTP 200 但 code≠0）：鉴权类 → AUTH_INVALID；其余按“超过每日额度”处理 */
function mapBusiness(json, httpStatus = null) {
  const msg = (json && (json.msg || json.errorMsg)) || '';
  const base = { provider: ID, httpStatus, raw: json, message: msg || undefined };
  if (AUTH_TEXT.test(msg)) return new ParseError('AUTH_INVALID', base);
  return new ParseError('QUOTA_EXCEEDED', base);
}

export function mapPaddleError(err) {
  if (isParseError(err)) return err;
  if (err && typeof err.status === 'number') return classifyHttpError(err, ID);
  if (err && err.code != null && ('msg' in err || 'errorMsg' in err)) return mapBusiness(err);
  return fromFetchFailure(err, ID);
}

async function request(url, init, token, ctx) {
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  }, { ctx, provider: ID, timeoutMs: ctx.requestTimeoutMs });
  if (!res.ok) throw mapPaddleError(await readErrorResponse(res));
  const json = await res.json();
  if (json && json.code != null && Number(json.code) !== 0) throw mapBusiness(json, res.status);
  return json;
}

const STATE_MAP = { pending: 'pending', queued: 'pending', running: 'running', processing: 'running', done: 'done', success: 'done', failed: 'failed', error: 'failed' };

export const paddleocrProvider = defineProvider({
  id: ID,
  label: 'PaddleOCR',
  hosts: [`${PADDLEOCR_BASE}/*`],
  credentialFields: [{ key: 'token', label: 'Access Token', secret: true }],
  keyUrl: 'https://aistudio.baidu.com/account/accessToken',
  dataHost: 'paddleocr.aistudio-app.com',
  mode: 'async',
  input: 'url',
  cost: 'free',
  output: 'markdown', // 交给 R4-09 统一整理
  timeoutMs: 10 * 60 * 1000,
  pollIntervalMs: 3000,

  async submit(input, creds, ctx = {}) {
    if (!creds || !creds.token) throw new ParseError('AUTH_INVALID', { provider: ID });
    const json = await request(PADDLEOCR_JOBS_URL, {
      method: 'POST',
      body: JSON.stringify({ fileUrl: input.url, model: (input.options && input.options.model) || PADDLEOCR_DEFAULT_MODEL }),
    }, creds.token, ctx);
    const jobId = json.data && json.data.jobId;
    if (!jobId) throw new ParseError('PROVIDER_FAILED', { provider: ID, raw: json, reason: 'missing jobId' });
    return { jobId };
  },

  async poll(jobId, creds, ctx = {}) {
    if (!creds || !creds.token) throw new ParseError('AUTH_INVALID', { provider: ID });
    const json = await request(`${PADDLEOCR_JOBS_URL}/${encodeURIComponent(jobId)}`, { method: 'GET' }, creds.token, ctx);
    const d = json.data || {};
    const state = STATE_MAP[String(d.state || '').toLowerCase()] || 'running';
    const p = d.extractProgress;
    const progress = p && p.totalPages > 0 ? { done: p.extractedPages || 0, total: p.totalPages } : null;
    if (state === 'done') {
      const r = d.resultUrl || {};
      if (!r.markdownUrl) throw new ParseError('PROVIDER_FAILED', { provider: ID, raw: json, reason: 'Completed job has no markdownUrl' });
      return { state, progress, result: { markdownUrl: r.markdownUrl, jsonUrl: r.jsonUrl || null }, raw: d };
    }
    if (state === 'failed') return { state, progress, error: d.errorMsg || 'Job failed', raw: d };
    return { state, progress, raw: d };
  },

  /** 取回 Markdown 原文（整理交给 R4-09 normalize） */
  async fetchResult(result, creds, ctx = {}) {
    let res;
    try {
      res = await fetchWithTimeout(result.markdownUrl, { method: 'GET' }, { ctx, provider: ID, timeoutMs: ctx.requestTimeoutMs || 60000 });
    } catch (e) { throw mapPaddleError(e); }
    if (!res.ok) throw mapPaddleError(await readErrorResponse(res));
    return { markdown: await res.text(), markdownUrl: result.markdownUrl, jsonUrl: result.jsonUrl || null };
  },

  mapError: mapPaddleError,

  /** 测试连接：GET 随机 jobId，绝不提交任务（不扣额度）。401/鉴权文本=Key 无效；404/400/业务码非鉴权=Key 有效 */
  async testConnection(creds, ctx = {}) {
    if (!creds || !creds.token) return { ok: false, error: new ParseError('AUTH_INVALID', { provider: ID }) };
    const fake = `fixture-probe-${Math.random().toString(16).slice(2, 14)}`;
    try {
      const res = await fetchWithTimeout(`${PADDLEOCR_JOBS_URL}/${fake}`, {
        method: 'GET', headers: { Authorization: `Bearer ${creds.token}` },
      }, { ctx, provider: ID, timeoutMs: 15000 });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = (json && (json.msg || json.errorMsg)) || '';
        if (json && Number(json.code) !== 0 && AUTH_TEXT.test(msg)) return { ok: false, error: mapBusiness(json, res.status) };
        return { ok: true };
      }
      if (res.status === 404 || res.status === 400) return { ok: true };
      const e = mapPaddleError(await readErrorResponse(res));
      if (['AUTH_INVALID', 'QUOTA_EXCEEDED', 'RATE_LIMITED'].includes(e.code)) return { ok: false, error: e };
      if (e.reason === 'forbidden_empty') return { ok: false, error: e };
      return e.httpStatus && e.httpStatus < 500 ? { ok: true } : { ok: false, error: e };
    } catch (e) {
      return { ok: false, error: mapPaddleError(e) };
    }
  },
});

export default paddleocrProvider;
