// R4-18：测试基建自检
import { createFetchMock, mockResponse } from '../helpers/fetch-mock';
import { installChrome } from '../helpers/chrome-stubs';
import fs from 'fs';
import path from 'path';

test('fetch mock 按 URL 和顺序返回，sticky 重复最后一个', async () => {
  const fm = createFetchMock().on('https://a/x', [{ json: { n: 1 } }, { json: { n: 2 } }], { sticky: true }).on(/b\.test/, [{ status: 403, body: '' }]);
  expect(await (await fm.fetch('https://a/x/1')).json()).toEqual({ n: 1 });
  expect(await (await fm.fetch('https://a/x/1')).json()).toEqual({ n: 2 });
  expect(await (await fm.fetch('https://a/x/1')).json()).toEqual({ n: 2 });
  const r = await fm.fetch('https://b.test/');
  expect([r.ok, r.status, await r.text()]).toEqual([false, 403, '']);
  await expect(fm.fetch('https://b.test/')).rejects.toThrow(/no response queued/);
  expect(fm.callsTo('https://a/').length).toBe(3);
  expect(mockResponse({ headers: { 'Retry-After': '1' } }).headers.get('retry-after')).toBe('1');
});

test('fetch mock 按 method 区分，可入队 Error', async () => {
  const fm = createFetchMock().on('https://a', [new TypeError('Failed to fetch')], { method: 'POST' }).on('https://a', [{ json: 1 }], { method: 'GET' });
  await expect(fm.fetch('https://a', { method: 'POST' })).rejects.toThrow(TypeError);
  expect(await (await fm.fetch('https://a')).json()).toBe(1);
});

test('chrome 桩：storage / onChanged / alarms（不再桩 permissions）', async () => {
  const c = installChrome({ sync: { a: 1 } });
  const seen = [];
  c.storage.onChanged.addListener((ch, area) => seen.push([area, Object.keys(ch)]));
  await c.storage.local.set({ k: { v: 1 } });
  expect(await c.storage.local.get('k')).toEqual({ k: { v: 1 } });
  expect(await c.storage.sync.get({ a: 0, b: 2 })).toEqual({ a: 1, b: 2 });
  await c.storage.sync.remove('a');
  expect(seen).toEqual([['local', ['k']], ['sync', ['a']]]);
  await c.alarms.create('keepAlive', { periodInMinutes: 0.4 });
  expect((await c.alarms.getAll()).map((a) => a.name)).toEqual(['keepAlive']);
  await c.alarms.clear('keepAlive');
  expect(await c.alarms.getAll()).toEqual([]);
  expect(c.permissions).toBeUndefined();
});

test('fixture 里没有真实 Key / 真实 jobId', () => {
  const dir = path.join(__dirname, '../fixtures/providers');
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => /\.(json|md)$/.test(f));
  expect(files.length).toBeGreaterThan(10);
  for (const f of files) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    expect(s).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{12,}|sk-[A-Za-z0-9]{12,}|eyJ[A-Za-z0-9_-]{20,}/);
    for (const id of s.match(/"(?:task_id|jobId)"\s*:\s*"([^"]+)"/g) || []) expect(id).toMatch(/fixture-|00000000-0000-4000-8000-/);
    for (const u of s.match(/https?:\/\/[^\s"')]+/g) || []) expect(new URL(u).hostname).toMatch(/\.invalid$/);
  }
});
