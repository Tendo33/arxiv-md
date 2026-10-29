// R4-03：9 类统一错误码。文案在宿主插件的 locales 里（err_<CODE> / err_action_<action>），core 只给码和动作。

export const ERROR_CODES = Object.freeze({
  AUTH_INVALID: 'AUTH_INVALID',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  FILE_UNSUPPORTED: 'FILE_UNSUPPORTED',
  TOO_LARGE: 'TOO_LARGE',
  NETWORK: 'NETWORK',
  PERMISSION_MISSING: 'PERMISSION_MISSING',
  TIMEOUT: 'TIMEOUT',
  PROVIDER_FAILED: 'PROVIDER_FAILED',
});

export const ALL_ERROR_CODES = Object.freeze(Object.keys(ERROR_CODES));

/** 下一步动作：settings=去设置，switch=换后端（只跳设置页，不自动切换），retry=重试，grant=去授权 */
export const ERROR_ACTIONS = Object.freeze({
  AUTH_INVALID: ['settings'],
  QUOTA_EXCEEDED: ['switch'],
  RATE_LIMITED: ['retry'],
  FILE_UNSUPPORTED: ['switch'],
  TOO_LARGE: ['switch'],
  NETWORK: ['retry'],
  PERMISSION_MISSING: ['grant'],
  TIMEOUT: ['retry'],
  PROVIDER_FAILED: ['retry', 'switch'],
});

/** 可细分的原因（不新增错误码）。forbidden_empty：403 且响应体为空，通常是网关因 Origin 拒绝，不是 Key 或额度问题 */
export const ERROR_REASONS = Object.freeze({
  FORBIDDEN_EMPTY_BODY: 'forbidden_empty',
  KEY_NOT_ON_DEVICE: 'key_not_on_device', // Key 不跨设备同步：后端选过但本设备没有 Key
  EMPTY_RESULT: 'empty_result', // AR-02：结果没有正文，不保存
  DNR_NOT_READY: 'dnr_not_ready', // R5-01：PaddleOCR 的网络规则（去 Origin 头）没装上
  INTERRUPTED_SUBMIT: 'interrupted_submit', // 审查 P2-3：提交/上传途中后台被回收，还没拿到任务号；不自动重传，避免重复扣额度
});

export class ParseError extends Error {
  /**
   * @param {string} code  ERROR_CODES 之一
   * @param {{provider?:string, httpStatus?:number|null, raw?:any, reason?:string, host?:string, message?:string, retryAfterMs?:number}} [info]
   */
  constructor(code, info = {}) {
    if (!ERROR_CODES[code]) throw new TypeError(`Unknown ParseError code: ${code}`);
    super(info.message || `${info.provider || 'provider'}: ${code}${info.reason ? ` (${info.reason})` : ''}`);
    this.name = 'ParseError';
    this.code = code;
    this.provider = info.provider || null;
    this.httpStatus = info.httpStatus ?? null;
    this.raw = info.raw ?? null;
    this.reason = info.reason || null;
    this.host = info.host || null;
    if (info.retryAfterMs != null) this.retryAfterMs = info.retryAfterMs;
  }

  get actions() { return ERROR_ACTIONS[this.code]; }

  toJSON() {
    return { name: this.name, code: this.code, provider: this.provider, httpStatus: this.httpStatus, reason: this.reason, host: this.host, message: this.message };
  }
}

export function isParseError(e) {
  return !!e && (e instanceof ParseError || (e.name === 'ParseError' && !!ERROR_CODES[e.code]));
}

/** 从序列化对象（如 storage 里的任务记录）还原 */
export function fromJSON(obj) {
  if (!obj || !ERROR_CODES[obj.code]) return null;
  return new ParseError(obj.code, obj);
}

/** fetch 层异常 → ParseError：AbortError=TIMEOUT，其余 TypeError 等=NETWORK */
export function fromFetchFailure(err, provider) {
  if (isParseError(err)) return err;
  if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return new ParseError('TIMEOUT', { provider, raw: String(err.message || err) });
  }
  return new ParseError('NETWORK', { provider, raw: String((err && err.message) || err) });
}

function parseRetryAfter(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, n * 1000);
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : null;
}

/**
 * HTTP 非 2xx 的通用分类（各 provider 的 mapError 可先做自己的判断，再回落到这里）。
 * 关键区分：401 → AUTH_INVALID；403 空 body → PROVIDER_FAILED(reason=forbidden_empty)；
 * 403 带 body → QUOTA_EXCEEDED（Paddle 超每日额度），body 明确说鉴权的除外；
 * 429 带 Retry-After → RATE_LIMITED，不带 → QUOTA_EXCEEDED；503 带 Retry-After → RATE_LIMITED。
 * @param {{status:number, bodyText?:string, json?:any, retryAfter?:string|null}} res
 */
export function classifyHttpError(res, provider) {
  const { status } = res;
  const bodyText = (res.bodyText || '').trim();
  const json = res.json ?? null;
  const raw = json ?? (bodyText || null);
  const base = { provider, httpStatus: status, raw };
  const msg = `${(json && (json.msg || json.message || json.errorMsg)) || ''}`;
  if (status === 401) return new ParseError('AUTH_INVALID', base);
  if (status === 403) {
    if (!bodyText && json == null) return new ParseError('PROVIDER_FAILED', { ...base, reason: ERROR_REASONS.FORBIDDEN_EMPTY_BODY });
    if (/token|auth|unauthori[sz]ed|api[ _-]?key|鉴权|认证|令牌/i.test(msg) && !/quota|limit|额度|配额|次数/i.test(msg)) {
      return new ParseError('AUTH_INVALID', base);
    }
    return new ParseError('QUOTA_EXCEEDED', base);
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(res.retryAfter);
    if (retryAfterMs != null) return new ParseError('RATE_LIMITED', { ...base, retryAfterMs });
    return new ParseError('QUOTA_EXCEEDED', base);
  }
  if (status === 503) {
    const retryAfterMs = parseRetryAfter(res.retryAfter);
    if (retryAfterMs != null) return new ParseError('RATE_LIMITED', { ...base, retryAfterMs });
  }
  if (status === 413) return new ParseError('TOO_LARGE', base);
  if (status === 415) return new ParseError('FILE_UNSUPPORTED', base);
  return new ParseError('PROVIDER_FAILED', { ...base, message: msg || undefined });
}

/** 读取 Response 供 classifyHttpError 使用（body 可能为空或非 JSON） */
export async function readErrorResponse(response) {
  let bodyText = '';
  try { bodyText = await response.text(); } catch (_) { bodyText = ''; }
  let json = null;
  if (bodyText.trim()) { try { json = JSON.parse(bodyText); } catch (_) { json = null; } }
  const retryAfter = response.headers && typeof response.headers.get === 'function' ? response.headers.get('Retry-After') : null;
  return { status: response.status, bodyText, json, retryAfter };
}

/**
 * 生成用户可见文案。t 为宿主的翻译表（含 err_<CODE> 和 err_action_<action>）。
 * @returns {{code:string, message:string, actions:Array<{id:string,label:string}>}}
 */
export function formatParseError(err, t, { providerLabel, host } = {}) {
  const e = isParseError(err) ? err : new ParseError('PROVIDER_FAILED', { raw: String((err && err.message) || err), message: (err && err.message) || String(err) });
  // rp2：{reason} 先替换——forbidden_empty 文案里本身带 {provider}，要在后面一并填上
  const fill = (s) => String(s || '')
    .replace(/\{reason\}/g, e.reason === ERROR_REASONS.FORBIDDEN_EMPTY_BODY ? (t.err_reason_forbidden_empty || e.reason) : (e.reason || (e.raw && typeof e.raw === 'object' ? (e.raw.msg || e.raw.message || e.raw.errorMsg) : e.raw) || e.message || ''))
    .replace(/\{provider\}/g, providerLabel || e.provider || '')
    .replace(/\{host\}/g, host || e.host || '');
  const key = e.code === 'PROVIDER_FAILED' && e.reason === ERROR_REASONS.FORBIDDEN_EMPTY_BODY ? 'err_PROVIDER_FAILED' : `err_${e.code}`;
  return {
    code: e.code,
    message: fill(t[key]),
    actions: ERROR_ACTIONS[e.code].map((id) => ({ id, label: t[`err_action_${id}`] || id })),
  };
}
