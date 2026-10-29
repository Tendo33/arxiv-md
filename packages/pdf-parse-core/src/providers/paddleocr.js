// R4-07：PaddleOCR provider（百度飞桨星河社区 API，异步任务）
// arXiv PDF：后台先下载（arxiv.org / export.arxiv.org 已在 host_permissions），再 multipart 上传（星河拒收 arXiv 链接，code 10004）；
// 其他来源：仍只传 fileUrl（扩展没有这些域名的权限，取不到文件）。
// 结果 JSONL 和图片在 *.bj.bcebos.com（无 CORS 头），需要可选 host 权限，和星河域名一起在用户选 PaddleOCR 时申请。
import { defineProvider } from '../provider.js';
import { ParseError, classifyHttpError, readErrorResponse, isParseError, fromFetchFailure } from '../errors.js';
import { fetchWithTimeout } from '../http.js';

export const PADDLEOCR_BASE = 'https://paddleocr.aistudio-app.com';
export const PADDLEOCR_JOBS_URL = `${PADDLEOCR_BASE}/api/v2/ocr/jobs`;
export const PADDLEOCR_RESULT_HOSTS = 'https://*.bj.bcebos.com/*'; // 待 Simon 批准的新可选权限
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

/** 星河 multipart 上传上限 50 MB（官方文档：链接 200 MB、上传 50 MB） */
export const PADDLEOCR_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const UPLOAD_HOSTS = new Set(['arxiv.org', 'www.arxiv.org', 'export.arxiv.org']);

/** 是否走「下载后上传」：只限 arXiv 自家域名（扩展有权限） */
export function shouldUploadFile(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && UPLOAD_HOSTS.has(u.hostname); } catch { return false; }
}

/** 后台下载 arXiv PDF → Blob；超 50 MB → TOO_LARGE；非 PDF → FILE_UNSUPPORTED */
export async function downloadPdf(url, ctx = {}) {
  const res = await fetchWithTimeout(url, { method: 'GET' }, { ctx, provider: ID, timeoutMs: ctx.downloadTimeoutMs || 120000 });
  if (!res.ok) throw classifyHttpError(await readErrorResponse(res), ID);
  const len = Number(res.headers && res.headers.get && res.headers.get('content-length'));
  if (len > PADDLEOCR_MAX_UPLOAD_BYTES) throw new ParseError('TOO_LARGE', { provider: ID, reason: 'upload_limit' });
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > PADDLEOCR_MAX_UPLOAD_BYTES) throw new ParseError('TOO_LARGE', { provider: ID, reason: 'upload_limit' });
  // %PDF 魔数；arXiv 偶尔返回 HTML（撤稿/未就绪）
  if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) throw new ParseError('FILE_UNSUPPORTED', { provider: ID, reason: 'not_pdf' });
  return new Blob([buf], { type: 'application/pdf' });
}

function fileNameOf(url) {
  const last = (String(url).split(/[?#]/)[0].split('/').pop() || 'paper').replace(/[^\w.-]/g, '_');
  return /\.pdf$/i.test(last) ? last : `${last}.pdf`;
}

/**
 * 解析星河 JSONL：每行 {result:{layoutParsingResults:[{markdown:{text,images}}]}, errorCode, errorMsg}。
 * 图片名是框坐标（imgs/img_in_chart_box_x_y_x_y.jpg），不同页可能重名 → 引用改成 page-{N}/imgs/...（normalize 的 defaultPageOf 认得）。
 * @returns {{markdown:string, images:{src:string,url:string,page:number}[], pages:number}}
 */
export function parsePaddleJsonl(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  const parts = []; const images = []; let page = 0;
  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch { throw new ParseError('PROVIDER_FAILED', { provider: ID, reason: 'bad_jsonl' }); }
    if (row.errorCode != null && Number(row.errorCode) !== 0) {
      throw new ParseError('PROVIDER_FAILED', { provider: ID, reason: row.errorMsg || `errorCode ${row.errorCode}`, raw: { errorCode: row.errorCode, errorMsg: row.errorMsg } });
    }
    const pages = (row.result && row.result.layoutParsingResults) || [];
    for (const pg of pages) {
      page += 1;
      const md = (pg && pg.markdown) || {};
      const imgMap = md.images || {};
      let t = String(md.text || '');
      for (const [name, url] of Object.entries(imgMap)) {
        const src = `page-${page}/${name.replace(/^\.?\//, '')}`;
        // 只替换完整的引用（src="name" / (name)），避免前缀相同的名字互相误伤
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        t = t.replace(new RegExp(`(["'(])${esc}(["')])`, 'g'), `$1${src}$2`);
        images.push({ src, url, page });
      }
      if (t.trim()) parts.push(t.trim());
    }
  }
  return { markdown: parts.join('\n\n'), images, pages: page };
}

async function request(url, init, token, ctx) {
  // multipart：不能写死 Content-Type，boundary 由 fetch 按 FormData 生成
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: isForm ? { Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  hosts: [`${PADDLEOCR_BASE}/*`, PADDLEOCR_RESULT_HOSTS],
  // R4-08：optional_host_permissions，选中 PaddleOCR 时在用户手势里申请
  permissionMode: 'optional',
  // DNR 可选权限：和域名权限一起申请，用于删除星河请求的 Origin 头（否则网关返回空 body 403）
  optionalPermissions: ['declarativeNetRequestWithHostAccess'],
  credentialFields: [{ key: 'token', label: 'Access Token', secret: true }],
  keyUrl: 'https://aistudio.baidu.com/account/accessToken',
  dataHost: 'paddleocr.aistudio-app.com',
  mode: 'async',
  input: 'url', // arXiv 链接在 submit 里转成文件上传，其余仍传链接
  cost: 'free',
  output: 'markdown', // 交给 R4-09 统一整理
  timeoutMs: 10 * 60 * 1000,
  pollIntervalMs: 3000,

  async submit(input, creds, ctx = {}) {
    if (!creds || !creds.token) throw new ParseError('AUTH_INVALID', { provider: ID });
    const model = (input.options && input.options.model) || PADDLEOCR_DEFAULT_MODEL;
    let body;
    if (shouldUploadFile(input.url)) {
      const blob = await downloadPdf(input.url, ctx);
      body = new FormData();
      body.append('model', model);
      body.append('optionalPayload', '{}');
      body.append('file', blob, fileNameOf(input.url));
    } else {
      body = JSON.stringify({ fileUrl: input.url, model });
    }
    const json = await request(PADDLEOCR_JOBS_URL, { method: 'POST', body }, creds.token, ctx);
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
      // 实测（2026-10-29）：resultUrl 只有 jsonUrl；markdownUrl 兼容旧文档
      if (!r.jsonUrl && !r.markdownUrl) throw new ParseError('PROVIDER_FAILED', { provider: ID, raw: json, reason: 'Completed job has no jsonUrl' });
      return { state, progress, result: { markdownUrl: r.markdownUrl || null, jsonUrl: r.jsonUrl || null }, raw: d };
    }
    if (state === 'failed') return { state, progress, error: d.errorMsg || 'Job failed', raw: d };
    return { state, progress, raw: d };
  },

  /** 取回结果：优先 jsonUrl（JSONL，每行一批页），否则旧的 markdownUrl。整理交给 R4-09 normalize */
  async fetchResult(result, creds, ctx = {}) {
    const url = result.jsonUrl || result.markdownUrl;
    let res;
    try {
      res = await fetchWithTimeout(url, { method: 'GET' }, { ctx, provider: ID, timeoutMs: ctx.requestTimeoutMs || 60000 });
    } catch (e) { throw mapPaddleError(e); }
    if (!res.ok) throw mapPaddleError(await readErrorResponse(res));
    const text = await res.text();
    if (!result.jsonUrl) return { markdown: text, markdownUrl: result.markdownUrl, jsonUrl: null, images: [] };
    return { ...parsePaddleJsonl(text), markdownUrl: null, jsonUrl: result.jsonUrl };
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
