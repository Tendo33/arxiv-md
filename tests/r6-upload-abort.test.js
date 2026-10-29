// 审查 P2-3：上传可取消（调用方 signal 与超时合并），删除任务立即中止且不写 jobId；SW 回收后不静默重传
import { fetchWithTimeout, anySignal } from '@pdf-core/http';
import { makeHarness, fakeProvider } from './helpers/runner-harness';

function hangingFetch() {
  const seen = [];
  const f = jest.fn((url, opts) => new Promise((_, rej) => {
    seen.push(opts.signal);
    opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); });
  }));
  return { f, seen };
}

test('fetchWithTimeout keeps the caller signal (merged with timeout)', async () => {
  const { f } = hangingFetch();
  const c = new AbortController();
  const p = fetchWithTimeout('https://x.invalid', { method: 'POST' }, { ctx: { fetch: f, signal: c.signal }, timeoutMs: 60000 });
  c.abort();
  await expect(p).rejects.toMatchObject({ callerAborted: true });
});

test('timeout still fires when a caller signal is present', async () => {
  const { f } = hangingFetch();
  const c = new AbortController();
  await expect(fetchWithTimeout('https://x.invalid', {}, { ctx: { fetch: f, signal: c.signal }, timeoutMs: 20 })).rejects.toMatchObject({ code: 'TIMEOUT' });
});

test('anySignal fallback forwards aborts', () => {
  const a = new AbortController(); const b = new AbortController();
  const s = anySignal([a.signal, b.signal]); b.abort(); expect(s.aborted).toBe(true);
});

test('deleting a task during upload aborts it and never stores a jobId', async () => {
  const { f, seen } = hangingFetch();
  const provider = fakeProvider({ submit: jest.fn((input, creds, ctx) => fetchWithTimeout('https://a.invalid/up', { method: 'POST' }, { ctx: { ...ctx, fetch: f }, timeoutMs: 600000 }).then(() => ({ jobId: 'never' }))) });
  const h = makeHarness({ providers: [provider], tasks: [{ id: 't1' }] });
  const done = h.runner.process('t1');
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  expect(seen.length).toBe(1);
  h.deleted.add('t1');
  expect(h.runner.abort('t1')).toBe(true);
  await expect(done).resolves.toEqual({ skipped: 'deleted' });
  expect(seen[0].aborted).toBe(true);
  expect(h.store.get('t1').jobId).toBeUndefined();
  expect(h.store.get('t1').status).not.toBe('failed');
  expect(provider.poll).not.toHaveBeenCalled();
});

test('delete lands right as submit returns: jobId is not stored, no polling', async () => {
  let h;
  const provider = fakeProvider({ submit: jest.fn(async () => { h.deleted.add('t1'); return { jobId: 'j' }; }) });
  h = makeHarness({ providers: [provider], tasks: [{ id: 't1' }] });
  await expect(h.runner.process('t1')).resolves.toEqual({ skipped: 'deleted' });
  expect(h.store.get('t1').jobId).toBeUndefined();
  expect(provider.poll).not.toHaveBeenCalled();
});

test('SW recycled mid-upload (submitStartedAt, no jobId): resume fails clearly, does not resend', async () => {
  const provider = fakeProvider();
  const h = makeHarness({ providers: [provider], tasks: [{ id: 't1', status: 'processing', submitStartedAt: 5 }] });
  await h.runner.resumeActiveTasks();
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  expect(provider.submit).not.toHaveBeenCalled();
  expect(h.store.get('t1')).toMatchObject({ status: 'failed', errorReason: 'interrupted_submit' });
});

test('normal submit clears submitStartedAt once the jobId is stored', async () => {
  const h = makeHarness({ tasks: [{ id: 't1' }] });
  await h.runner.process('t1');
  expect(h.store.get('t1').submitStartedAt).toBeNull();
  expect(h.store.get('t1').status).toBe('completed');
});
