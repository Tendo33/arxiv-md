// R4-07：PaddleOCR provider：4 种状态 + 5 种错误 + 契约
import { paddleocrProvider, PADDLEOCR_JOBS_URL, PADDLEOCR_DEFAULT_MODEL, PADDLEOCR_MAX_UPLOAD_BYTES, shouldUploadFile, parsePaddleJsonl } from '@pdf-core/providers/paddleocr';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createFetchMock } from '../helpers/fetch-mock';
import { runProviderContract } from '../helpers/provider-contract';
import submitOk from '../fixtures/providers/paddleocr/submit-ok.json';
import pending from '../fixtures/providers/paddleocr/poll-pending.json';
import running from '../fixtures/providers/paddleocr/poll-running.json';
import done from '../fixtures/providers/paddleocr/poll-done.json';
import doneLegacy from '../fixtures/providers/paddleocr/poll-done-legacy-md.json';
import failed from '../fixtures/providers/paddleocr/poll-failed.json';
import err401 from '../fixtures/providers/paddleocr/err-401.json';
import quota403 from '../fixtures/providers/paddleocr/err-quota-403.json';
import nonzero from '../fixtures/providers/paddleocr/err-code-nonzero.json';

const fs = require('fs');
const path = require('path');
const MD = fs.readFileSync(path.join(__dirname, '../fixtures/providers/paddleocr/result.md'), 'utf8');
const JOB = submitOk.data.jobId;
const creds = { token: 'test-token-placeholder' };
const input = { url: 'https://arxiv.org/pdf/2401.00001.pdf' };
const MD_URL = doneLegacy.data.resultUrl.markdownUrl;
const JSON_URL = done.data.resultUrl.jsonUrl;
const JSONL = fs.readFileSync(path.join(__dirname, '../fixtures/providers/paddleocr/result.jsonl'), 'utf8');
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]); // "%PDF-1.7\n"
const withPdf = (f) => (fm) => { fm.on(input.url, [{ body: PDF_BYTES }], { method: 'GET', sticky: true }); return f(fm); };

runProviderContract('paddleocr', {
  provider: paddleocrProvider, creds, input, expectJobId: JOB, expectResultKeys: ['markdown'],
  happy: (fm) => fm.on(input.url, [{ body: PDF_BYTES }], { method: 'GET' }).on(PADDLEOCR_JOBS_URL, [{ json: submitOk }], { method: 'POST' })
    .on(`${PADDLEOCR_JOBS_URL}/`, [{ json: pending }, { json: running }, { json: done }], { method: 'GET' })
    .on(JSON_URL, [{ body: JSONL }]),
  errors: {
    AUTH_INVALID: withPdf((fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 401, json: err401 }]); }),
    QUOTA_EXCEEDED: withPdf((fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 403, json: quota403 }]); }),
    RATE_LIMITED: withPdf((fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 429, body: '', headers: { 'Retry-After': '3' } }]); }),
    FILE_UNSUPPORTED: withPdf((fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 415, body: 'unsupported' }]); }),
    TOO_LARGE: withPdf((fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 413, body: 'too large' }]); }),
    NETWORK: withPdf((fm) => { fm.on(PADDLEOCR_JOBS_URL, [new TypeError('Failed to fetch')]); }),
    PERMISSION_MISSING: () => ({ ctx: { fetch: async () => { throw new (require('@pdf-core/errors').ParseError)('PERMISSION_MISSING', { provider: 'paddleocr' }); } } }),
    TIMEOUT: withPdf((fm) => { fm.on(PADDLEOCR_JOBS_URL, [Object.assign(new Error('aborted'), { name: 'AbortError' })]); }),
    PROVIDER_FAILED: withPdf((fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 500, body: '<html>' }]); }),
  },
});

describe('PaddleOCR 细节', () => {
  let fm;
  beforeEach(() => { fm = createFetchMock(); global.fetch = fm.fetch; });

  test('submit：arXiv 链接 → 先下载 PDF，再 multipart 上传 file/model/optionalPayload，不带 JSON 头', async () => {
    fm.on(input.url, [{ body: PDF_BYTES }, { body: PDF_BYTES }], { method: 'GET' });
    fm.on(PADDLEOCR_JOBS_URL, [{ json: submitOk }, { json: submitOk }], { method: 'POST' });
    expect(await paddleocrProvider.submit(input, creds, {})).toEqual({ jobId: JOB });
    const post = fm.calls.find((c) => c.method === 'POST');
    expect(post.body).toBeInstanceOf(FormData);
    expect(post.body.get('model')).toBe(PADDLEOCR_DEFAULT_MODEL);
    expect(post.body.get('optionalPayload')).toBe('{}');
    const file = post.body.get('file');
    expect(file.name).toBe('2401.00001.pdf');
    expect(file.type).toBe('application/pdf');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PDF_BYTES);
    expect(post.body.has('fileUrl')).toBe(false);
    expect(post.init.headers).toEqual({ Authorization: 'Bearer test-token-placeholder' });
    await paddleocrProvider.submit({ ...input, options: { model: 'PaddleOCR-VL-1.6' } }, creds, {});
    expect(fm.calls.filter((c) => c.method === 'POST')[1].body.get('model')).toBe('PaddleOCR-VL-1.6');
  });

  test('submit：非 arXiv 来源仍传 JSON {fileUrl, model}，不下载', async () => {
    fm.on(PADDLEOCR_JOBS_URL, [{ json: submitOk }]);
    const other = { url: 'https://example.invalid/paper.pdf' };
    expect(await paddleocrProvider.submit(other, creds, {})).toEqual({ jobId: JOB });
    expect(fm.calls.length).toBe(1);
    expect(JSON.parse(fm.calls[0].body)).toEqual({ fileUrl: other.url, model: PADDLEOCR_DEFAULT_MODEL });
    expect(fm.calls[0].init.headers['Content-Type']).toBe('application/json');
  });

  test('shouldUploadFile：只认 https 的 arxiv.org / export.arxiv.org', () => {
    expect(shouldUploadFile('https://arxiv.org/pdf/1706.03762')).toBe(true);
    expect(shouldUploadFile('https://export.arxiv.org/pdf/1706.03762v7.pdf')).toBe(true);
    expect(shouldUploadFile('http://arxiv.org/pdf/1706.03762')).toBe(false);
    expect(shouldUploadFile('https://arxiv.org.evil.invalid/pdf/1')).toBe(false);
    expect(shouldUploadFile('not a url')).toBe(false);
  });

  test('下载 PDF 失败：超 50 MB → TOO_LARGE；不是 PDF → FILE_UNSUPPORTED；404 / 断网 → 不提交任务', async () => {
    fm.on(input.url, [
      { body: PDF_BYTES, headers: { 'Content-Length': String(PADDLEOCR_MAX_UPLOAD_BYTES + 1) } },
      { body: '<html>not ready</html>' },
      { status: 404, body: '' },
      new TypeError('Failed to fetch'),
    ], { method: 'GET' });
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'TOO_LARGE', reason: 'upload_limit' });
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'FILE_UNSUPPORTED', reason: 'not_pdf' });
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'PROVIDER_FAILED', httpStatus: 404 });
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'NETWORK' });
    expect(fm.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  test('poll：4 种状态 + 页数进度', async () => {
    fm.on(`${PADDLEOCR_JOBS_URL}/`, [{ json: pending }, { json: running }, { json: done }, { json: failed }]);
    expect((await paddleocrProvider.poll(JOB, creds, {})).state).toBe('pending');
    const r = await paddleocrProvider.poll(JOB, creds, {});
    expect(r).toMatchObject({ state: 'running', progress: { done: 5, total: 12 } });
    expect((await paddleocrProvider.poll(JOB, creds, {})).result).toEqual({ markdownUrl: null, jsonUrl: JSON_URL });
    expect(await paddleocrProvider.poll(JOB, creds, {})).toMatchObject({ state: 'failed', error: 'failed to download fileUrl' });
    expect(fm.calls[0].url).toBe(`${PADDLEOCR_JOBS_URL}/${JOB}`);
  });

  test('5 种错误（arXiv 上传后提交）：401 / 403 有体=额度 / 403 空体≠401≠额度 / code≠0 / done 缺 markdownUrl', async () => {
    fm.on(input.url, [{ body: PDF_BYTES }], { method: 'GET', sticky: true });
    fm.on(PADDLEOCR_JOBS_URL, [{ status: 401, json: err401 }, { status: 403, json: quota403 }, { status: 403, body: '' }, { json: nonzero }, { json: { code: 0, data: {} } }]);
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'AUTH_INVALID', httpStatus: 401 });
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED', httpStatus: 403 });
    const empty = await paddleocrProvider.submit(input, creds, {}).catch((e) => e);
    expect(empty).toMatchObject({ code: 'PROVIDER_FAILED', reason: 'forbidden_empty', httpStatus: 403 });
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'PROVIDER_FAILED' });
    fm.on(`${PADDLEOCR_JOBS_URL}/`, [{ json: { code: 0, data: { state: 'done', resultUrl: {} } } }]);
    await expect(paddleocrProvider.poll(JOB, creds, {})).rejects.toMatchObject({ code: 'PROVIDER_FAILED' });
  });

  test('code≠0 且文本是鉴权类 → AUTH_INVALID', async () => {
    fm.on(input.url, [{ body: PDF_BYTES }], { method: 'GET' });
    fm.on(PADDLEOCR_JOBS_URL, [{ json: { code: 10001, msg: 'invalid access token' } }]);
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });

  test('没 token → AUTH_INVALID，不发请求', async () => {
    await expect(paddleocrProvider.submit(input, {}, {})).rejects.toMatchObject({ code: 'AUTH_INVALID' });
    await expect(paddleocrProvider.poll(JOB, null, {})).rejects.toMatchObject({ code: 'AUTH_INVALID' });
    expect(fm.calls.length).toBe(0);
  });

  test('fetchResult（旧格式）：只有 markdownUrl 时取原文；失败映射', async () => {
    fm.on(MD_URL, [{ body: MD }, { status: 403, body: '' }, new TypeError('x')]);
    const r = await paddleocrProvider.fetchResult(doneLegacy.data.resultUrl, creds, {});
    expect(r.markdown).toBe(MD);
    expect(r.images).toEqual([]);
    await expect(paddleocrProvider.fetchResult(doneLegacy.data.resultUrl, creds, {})).rejects.toMatchObject({ reason: 'forbidden_empty' });
    await expect(paddleocrProvider.fetchResult(doneLegacy.data.resultUrl, creds, {})).rejects.toMatchObject({ code: 'NETWORK' });
  });

  test('fetchResult（实测格式）：jsonUrl → JSONL 多行多页拼接 markdown.text，图片按页加前缀并下载', async () => {
    fm.on(JSON_URL, [{ body: JSONL }]);
    const IMG = 'https://pplines-online.bj.bcebos.example.invalid/fixture/';
    fm.on(`${IMG}p1.jpg`, [{ body: new Uint8Array([1, 2, 3]), headers: { 'Content-Type': 'image/jpeg' } }]);
    fm.on(`${IMG}p3a.jpg`, [{ status: 404, body: '' }]);
    fm.on(`${IMG}p3b.png`, [new TypeError('Failed to fetch')]);
    const r = await paddleocrProvider.fetchResult(done.data.resultUrl, creds, {});
    expect(fm.calls[0].url).toBe(JSON_URL);
    expect(fm.calls.length).toBe(4);
    expect(r.images[0]).toMatchObject({ data: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg', error: null });
    expect(r.images[1]).toMatchObject({ data: null, error: 'HTTP 404' });
    expect(r.images[2]).toMatchObject({ data: null, error: 'NETWORK' });
    r.images = r.images.map(({ src, url, page }) => ({ src, url, page }));
    expect(r.jsonUrl).toBe(JSON_URL);
    expect(r.markdown.startsWith('# Fixture Paper')).toBe(true);
    expect(r.markdown).toMatch(/<table>/);
    expect(r.markdown).toMatch(/\$\$ y = x \\cdot \\Phi\(x\) \$\$/);
    expect(r.markdown.indexOf('# Fixture Paper')).toBeLessThan(r.markdown.indexOf('## Results'));
    // 第 1 页和第 3 页同名（框坐标相同）→ 前缀区分，不串图
    expect(r.markdown).toMatch(/src="page-1\/imgs\/img_in_chart_box_10_20_30_40\.jpg"/);
    expect(r.markdown).toMatch(/src="page-3\/imgs\/img_in_chart_box_10_20_30_40\.jpg"/);
    expect(r.markdown).toMatch(/!\[\]\(page-3\/imgs\/img_in_image_box_1_2_3_4\.png\)/);
    expect(r.markdown).not.toMatch(/["(]imgs\//);
    expect(r.images).toEqual([
      { src: 'page-1/imgs/img_in_chart_box_10_20_30_40.jpg', url: 'https://pplines-online.bj.bcebos.example.invalid/fixture/p1.jpg?authorization=fixture', page: 1 },
      { src: 'page-3/imgs/img_in_chart_box_10_20_30_40.jpg', url: 'https://pplines-online.bj.bcebos.example.invalid/fixture/p3a.jpg?authorization=fixture', page: 3 },
      { src: 'page-3/imgs/img_in_image_box_1_2_3_4.png', url: 'https://pplines-online.bj.bcebos.example.invalid/fixture/p3b.png?authorization=fixture', page: 3 },
    ]);
  });

  test('图片下载没有 bcebos 权限 → 整个任务 PERMISSION_MISSING（不静默丢图）', async () => {
    const { ParseError } = require('@pdf-core/errors');
    let n = 0;
    const ctx = { fetch: async (u) => { n += 1; if (n === 1) return require('../helpers/fetch-mock').mockResponse({ body: JSONL }); throw new ParseError('PERMISSION_MISSING', { provider: 'paddleocr', host: '*.bj.bcebos.com' }); } };
    await expect(paddleocrProvider.fetchResult(done.data.resultUrl, creds, ctx)).rejects.toMatchObject({ code: 'PERMISSION_MISSING' });
  });

  test('parsePaddleJsonl：行内 errorCode≠0 / 坏行 → PROVIDER_FAILED；空行忽略；页数按页累计', () => {
    expect(parsePaddleJsonl(`\n${JSONL}\n\n`).pages).toBe(3);
    expect(() => parsePaddleJsonl('{"errorCode":500,"errorMsg":"page parse failed"}')).toThrow(expect.objectContaining({ code: 'PROVIDER_FAILED', reason: 'page parse failed' }));
    expect(() => parsePaddleJsonl('not json')).toThrow(expect.objectContaining({ code: 'PROVIDER_FAILED', reason: 'bad_jsonl' }));
    expect(parsePaddleJsonl('')).toEqual({ markdown: '', images: [], pages: 0 });
  });

  test('testConnection：GET 随机 jobId，从不 POST', async () => {
    fm.on(`${PADDLEOCR_JOBS_URL}/`, [{ status: 401, json: err401 }, { status: 404, body: '' }, { json: { code: 10004, msg: 'job not found' } }, { status: 403, body: '' }, { status: 403, json: quota403 }, { status: 500, body: '' }, new TypeError('x')]);
    expect((await paddleocrProvider.testConnection(creds, {})).error.code).toBe('AUTH_INVALID');
    expect((await paddleocrProvider.testConnection(creds, {})).ok).toBe(true);
    expect((await paddleocrProvider.testConnection(creds, {})).ok).toBe(true);
    expect((await paddleocrProvider.testConnection(creds, {})).error.reason).toBe('forbidden_empty');
    expect((await paddleocrProvider.testConnection(creds, {})).error.code).toBe('QUOTA_EXCEEDED');
    expect((await paddleocrProvider.testConnection(creds, {})).ok).toBe(false);
    expect((await paddleocrProvider.testConnection(creds, {})).error.code).toBe('NETWORK');
    expect(fm.calls.every((c) => c.method === 'GET')).toBe(true);
    const ids = fm.calls.map((c) => c.url.split('/').pop());
    expect(new Set(ids).size).toBe(ids.length);
    expect((await paddleocrProvider.testConnection({}, {})).ok).toBe(false);
  });

  test('默认注册表顺序：PaddleOCR 在前', () => {
    expect(createDefaultRegistry().ids()).toEqual(['paddleocr', 'mineru']);
    expect(paddleocrProvider.hosts).toEqual(['https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*']);
  });
});
