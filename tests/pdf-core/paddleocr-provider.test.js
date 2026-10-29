// R4-07：PaddleOCR provider：4 种状态 + 5 种错误 + 契约
import { paddleocrProvider, PADDLEOCR_JOBS_URL, PADDLEOCR_DEFAULT_MODEL } from '@pdf-core/providers/paddleocr';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createFetchMock } from '../helpers/fetch-mock';
import { runProviderContract } from '../helpers/provider-contract';
import submitOk from '../fixtures/providers/paddleocr/submit-ok.json';
import pending from '../fixtures/providers/paddleocr/poll-pending.json';
import running from '../fixtures/providers/paddleocr/poll-running.json';
import done from '../fixtures/providers/paddleocr/poll-done.json';
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
const MD_URL = done.data.resultUrl.markdownUrl;

runProviderContract('paddleocr', {
  provider: paddleocrProvider, creds, input, expectJobId: JOB, expectResultKeys: ['markdown'],
  happy: (fm) => fm.on(PADDLEOCR_JOBS_URL, [{ json: submitOk }], { method: 'POST' })
    .on(`${PADDLEOCR_JOBS_URL}/`, [{ json: pending }, { json: running }, { json: done }], { method: 'GET' })
    .on(MD_URL, [{ body: MD }]),
  errors: {
    AUTH_INVALID: (fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 401, json: err401 }]); },
    QUOTA_EXCEEDED: (fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 403, json: quota403 }]); },
    RATE_LIMITED: (fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 429, body: '', headers: { 'Retry-After': '3' } }]); },
    FILE_UNSUPPORTED: (fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 415, body: 'unsupported' }]); },
    TOO_LARGE: (fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 413, body: 'too large' }]); },
    NETWORK: (fm) => { fm.on(PADDLEOCR_JOBS_URL, [new TypeError('Failed to fetch')]); },
    PERMISSION_MISSING: () => ({ ctx: { fetch: async () => { throw new (require('@pdf-core/errors').ParseError)('PERMISSION_MISSING', { provider: 'paddleocr' }); } } }),
    TIMEOUT: (fm) => { fm.on(PADDLEOCR_JOBS_URL, [Object.assign(new Error('aborted'), { name: 'AbortError' })]); },
    PROVIDER_FAILED: (fm) => { fm.on(PADDLEOCR_JOBS_URL, [{ status: 500, body: '<html>' }]); },
  },
});

describe('PaddleOCR 细节', () => {
  let fm;
  beforeEach(() => { fm = createFetchMock(); global.fetch = fm.fetch; });

  test('submit：JSON {fileUrl, model} + Bearer，传 URL 不传文件', async () => {
    fm.on(PADDLEOCR_JOBS_URL, [{ json: submitOk }, { json: submitOk }]);
    expect(await paddleocrProvider.submit(input, creds, {})).toEqual({ jobId: JOB });
    const c = fm.calls[0];
    expect(c.method).toBe('POST');
    expect(JSON.parse(c.body)).toEqual({ fileUrl: input.url, model: PADDLEOCR_DEFAULT_MODEL });
    expect(c.init.headers.Authorization).toBe('Bearer test-token-placeholder');
    await paddleocrProvider.submit({ ...input, options: { model: 'PaddleOCR-VL-1.6' } }, creds, {});
    expect(JSON.parse(fm.calls[1].body).model).toBe('PaddleOCR-VL-1.6');
  });

  test('poll：4 种状态 + 页数进度', async () => {
    fm.on(`${PADDLEOCR_JOBS_URL}/`, [{ json: pending }, { json: running }, { json: done }, { json: failed }]);
    expect((await paddleocrProvider.poll(JOB, creds, {})).state).toBe('pending');
    const r = await paddleocrProvider.poll(JOB, creds, {});
    expect(r).toMatchObject({ state: 'running', progress: { done: 5, total: 12 } });
    expect((await paddleocrProvider.poll(JOB, creds, {})).result).toEqual({ markdownUrl: MD_URL, jsonUrl: done.data.resultUrl.jsonUrl });
    expect(await paddleocrProvider.poll(JOB, creds, {})).toMatchObject({ state: 'failed', error: 'failed to download fileUrl' });
    expect(fm.calls[0].url).toBe(`${PADDLEOCR_JOBS_URL}/${JOB}`);
  });

  test('5 种错误：401 / 403 有体=额度 / 403 空体≠401≠额度 / code≠0 / done 缺 markdownUrl', async () => {
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
    fm.on(PADDLEOCR_JOBS_URL, [{ json: { code: 10001, msg: 'invalid access token' } }]);
    await expect(paddleocrProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });

  test('没 token → AUTH_INVALID，不发请求', async () => {
    await expect(paddleocrProvider.submit(input, {}, {})).rejects.toMatchObject({ code: 'AUTH_INVALID' });
    await expect(paddleocrProvider.poll(JOB, null, {})).rejects.toMatchObject({ code: 'AUTH_INVALID' });
    expect(fm.calls.length).toBe(0);
  });

  test('fetchResult：取 markdownUrl 原文；失败映射', async () => {
    fm.on(MD_URL, [{ body: MD }, { status: 403, body: '' }, new TypeError('x')]);
    const r = await paddleocrProvider.fetchResult(done.data.resultUrl, creds, {});
    expect(r.markdown).toBe(MD);
    await expect(paddleocrProvider.fetchResult(done.data.resultUrl, creds, {})).rejects.toMatchObject({ reason: 'forbidden_empty' });
    await expect(paddleocrProvider.fetchResult(done.data.resultUrl, creds, {})).rejects.toMatchObject({ code: 'NETWORK' });
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
