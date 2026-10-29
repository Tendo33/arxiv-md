// R4-04：MinerU provider 行为不变 + 契约
import { mineruProvider, MINERU_TASK_URL } from '@pdf-core/providers/mineru';
import { createFetchMock } from '../helpers/fetch-mock';
import { runProviderContract } from '../helpers/provider-contract';
import submitOk from '../fixtures/providers/mineru/submit-ok.json';
import pending from '../fixtures/providers/mineru/poll-pending.json';
import running from '../fixtures/providers/mineru/poll-running.json';
import done from '../fixtures/providers/mineru/poll-done.json';
import failed from '../fixtures/providers/mineru/poll-failed.json';
import err401 from '../fixtures/providers/mineru/err-401.json';
import nonzero from '../fixtures/providers/mineru/err-code-nonzero.json';

const JOB = submitOk.data.task_id;
const creds = { token: 'test-token-placeholder' };
const input = { url: 'https://arxiv.org/pdf/2401.00001.pdf', dataId: '2401.00001' };

runProviderContract('mineru', {
  provider: mineruProvider, creds, input, expectJobId: JOB, expectResultKeys: ['zipUrl'],
  happy: (fm) => fm.on(MINERU_TASK_URL, [{ json: submitOk }], { method: 'POST' })
    .on(`${MINERU_TASK_URL}/`, [{ json: pending }, { json: running }, { json: done }], { method: 'GET' }),
  errors: {
    AUTH_INVALID: (fm) => { fm.on(MINERU_TASK_URL, [{ status: 401, json: err401 }]); },
    QUOTA_EXCEEDED: (fm) => { fm.on(MINERU_TASK_URL, [{ status: 429, body: '' }]); },
    RATE_LIMITED: (fm) => { fm.on(MINERU_TASK_URL, [{ status: 503, body: '', headers: { 'Retry-After': '2' } }]); },
    FILE_UNSUPPORTED: (fm) => { fm.on(MINERU_TASK_URL, [{ json: { code: -60002, msg: 'unsupported format' } }]); },
    TOO_LARGE: (fm) => { fm.on(MINERU_TASK_URL, [{ json: nonzero }]); },
    NETWORK: (fm) => { fm.on(MINERU_TASK_URL, [new TypeError('Failed to fetch')]); },
    PERMISSION_MISSING: () => ({ ctx: { fetch: async () => { throw new (require('@pdf-core/errors').ParseError)('PERMISSION_MISSING', { provider: 'mineru' }); } } }),
    TIMEOUT: (fm) => { fm.on(MINERU_TASK_URL, [Object.assign(new Error('aborted'), { name: 'AbortError' })]); },
    PROVIDER_FAILED: (fm) => { fm.on(MINERU_TASK_URL, [{ status: 500, body: '<html>' }]); },
  },
});

// RATE_LIMITED：503 + Retry-After；429 一律按旧行为算额度
describe('MinerU 细节', () => {
  let fm;
  beforeEach(() => { fm = createFetchMock(); global.fetch = fm.fetch; });

  test('请求体与 1.1.12 一致', async () => {
    fm.on(MINERU_TASK_URL, [{ json: submitOk }]);
    await mineruProvider.submit(input, creds, {});
    const c = fm.calls[0];
    expect(c.method).toBe('POST');
    expect(JSON.parse(c.body)).toEqual({ url: input.url, model_version: 'vlm', language: 'en', data_id: '2401.00001' });
    expect(c.init.headers.Authorization).toBe('Bearer test-token-placeholder');
  });
  test('429 即使带 Retry-After 也保持旧行为 = QUOTA_EXCEEDED', async () => {
    fm.on(MINERU_TASK_URL, [{ status: 429, body: '', headers: { 'Retry-After': '5' } }]);
    await expect(mineruProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
  });
  test('没 token → AUTH_INVALID，不发请求', async () => {
    await expect(mineruProvider.submit(input, {}, {})).rejects.toMatchObject({ code: 'AUTH_INVALID' });
    expect(fm.calls.length).toBe(0);
  });
  test('poll：failed / 进度 / done 缺 zip', async () => {
    fm.on(`${MINERU_TASK_URL}/`, [{ json: failed }, { json: running }, { json: { code: 0, data: { state: 'done' } } }]);
    expect(await mineruProvider.poll(JOB, creds, {})).toMatchObject({ state: 'failed', error: 'file is encrypted' });
    expect((await mineruProvider.poll(JOB, creds, {})).progress).toEqual({ done: 3, total: 12 });
    await expect(mineruProvider.poll(JOB, creds, {})).rejects.toMatchObject({ code: 'PROVIDER_FAILED' });
  });
  test('submit 缺 task_id', async () => {
    fm.on(MINERU_TASK_URL, [{ json: { code: 0, data: {} } }]);
    await expect(mineruProvider.submit(input, creds, {})).rejects.toMatchObject({ code: 'PROVIDER_FAILED' });
  });
  test('testConnection：GET 随机 task_id，从不 POST', async () => {
    fm.on(`${MINERU_TASK_URL}/`, [{ status: 401, json: err401 }, { json: { code: -60012, msg: 'task not found' } }, { status: 404, body: '' }, { json: err401 }, new TypeError('x')]);
    expect((await mineruProvider.testConnection(creds, {})).error.code).toBe('AUTH_INVALID');
    expect((await mineruProvider.testConnection(creds, {})).ok).toBe(true);
    expect((await mineruProvider.testConnection(creds, {})).ok).toBe(true);
    expect((await mineruProvider.testConnection(creds, {})).ok).toBe(false);
    expect((await mineruProvider.testConnection(creds, {})).error.code).toBe('NETWORK');
    expect(fm.calls.every((c) => c.method === 'GET')).toBe(true);
    const ids = fm.calls.map((c) => c.url.split('/').pop());
    expect(new Set(ids).size).toBe(ids.length);
    expect((await mineruProvider.testConnection({}, {})).ok).toBe(false);
  });
  test('mapError 兜底', () => {
    expect(mineruProvider.mapError({ code: 'A0211', msg: 'expired' }).code).toBe('AUTH_INVALID');
    expect(mineruProvider.mapError(new TypeError('x')).code).toBe('NETWORK');
    expect(mineruProvider.mapError({ status: 403, bodyText: '' }).reason).toBe('forbidden_empty');
  });
});
