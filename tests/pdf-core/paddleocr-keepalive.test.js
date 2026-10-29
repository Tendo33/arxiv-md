const { paddleocrProvider: P } = require('@pdf-core/providers/paddleocr');
const { withKeepAlive, KEEPALIVE_INTERVAL_MS } = require('@pdf-core/keepalive');

const ok = (body) => ({ ok: true, status: 200, json: async () => body, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 x').buffer, headers: { get: () => 'application/pdf' } });
afterEach(() => { jest.useRealTimers(); delete global.chrome; });

test('间隔 20 秒（低于 Chrome 30 秒空闲回收）', () => expect(KEEPALIVE_INTERVAL_MS).toBe(20000));

test('慢上传期间每 20 秒 getPlatformInfo，结束后停止', async () => {
  jest.useFakeTimers();
  const getPlatformInfo = jest.fn(async () => ({ os: 'linux' }));
  global.chrome = { runtime: { getPlatformInfo } };
  let release;
  const fetch = jest.fn((url) => (String(url).includes('arxiv.org') ? Promise.resolve(ok({}))
    : new Promise((r) => { release = () => r(ok({ code: 0, data: { jobId: 'j' } })); })));
  const p = P.submit({ url: 'https://arxiv.org/pdf/1706.03762' }, { token: 't' }, { fetch });
  for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
  await jest.advanceTimersByTimeAsync(150000);
  expect(getPlatformInfo).toHaveBeenCalledTimes(7);
  release();
  await expect(p).resolves.toEqual({ jobId: 'j' });
  await jest.advanceTimersByTimeAsync(100000);
  expect(getPlatformInfo).toHaveBeenCalledTimes(7);
});

test('上传失败也清理计时器', async () => {
  jest.useFakeTimers();
  const ping = jest.fn();
  await expect(withKeepAlive(async () => { throw new Error('x'); }, { ping })).rejects.toThrow('x');
  await jest.advanceTimersByTimeAsync(60000);
  expect(ping).not.toHaveBeenCalled();
});

test('非 arXiv（只发链接）不保活', async () => {
  jest.useFakeTimers();
  const getPlatformInfo = jest.fn();
  global.chrome = { runtime: { getPlatformInfo } };
  const spy = jest.spyOn(global, 'setInterval');
  const fetch = jest.fn(async () => ok({ code: 0, data: { jobId: 'k' } }));
  await P.submit({ url: 'https://example.org/a.pdf' }, { token: 't' }, { fetch });
  expect(spy).not.toHaveBeenCalled();
});

test('没有扩展运行时（Node）直接执行', async () => {
  await expect(withKeepAlive(async () => 5)).resolves.toBe(5);
});
