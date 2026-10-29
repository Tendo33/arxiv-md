const { paddleocrProvider: P, PADDLEOCR_UPLOAD_TIMEOUT_MS } = require('@pdf-core/providers/paddleocr');

function recorder() {
  const timers = [];
  const realSet = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms, ...a) => { timers.push(ms); return realSet(() => {}, 0); });
  return timers;
}
afterEach(() => jest.restoreAllMocks());

const ok = (body) => ({ ok: true, status: 200, json: async () => body, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 x').buffer, headers: { get: () => 'application/pdf' } });

test('multipart 上传用 5 分钟超时（实测 2.2 MB 要 137s），不是 30s 默认值', async () => {
  expect(PADDLEOCR_UPLOAD_TIMEOUT_MS).toBe(300000);
  const timers = recorder();
  const fetch = jest.fn(async (url) => (String(url).includes('arxiv.org') ? ok({}) : ok({ code: 0, data: { jobId: 'j1' } })));
  const r = await P.submit({ url: 'https://arxiv.org/pdf/1706.03762' }, { token: 't' }, { fetch });
  expect(r.jobId).toBe('j1');
  expect(fetch.mock.calls[1][1].body).toBeInstanceOf(FormData);
  expect(timers).toContain(300000);
});

test('ctx.uploadTimeoutMs 可覆盖；非 arXiv（JSON fileUrl）仍用普通请求超时', async () => {
  let timers = recorder();
  const fetch = jest.fn(async (url) => (String(url).includes('arxiv.org') ? ok({}) : ok({ code: 0, data: { jobId: 'j2' } })));
  await P.submit({ url: 'https://arxiv.org/pdf/1706.03762' }, { token: 't' }, { fetch, uploadTimeoutMs: 1234 });
  expect(timers).toContain(1234);
  jest.restoreAllMocks(); timers = recorder();
  await P.submit({ url: 'https://example.org/a.pdf' }, { token: 't' }, { fetch });
  expect(timers).not.toContain(300000);
  expect(timers).toContain(30000);
});
