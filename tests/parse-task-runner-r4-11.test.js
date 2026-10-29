import { makeHarness, fakeProvider } from './helpers/runner-harness';
import { ParseError } from '@pdf-core/errors';

describe('R4-11 parse-task-runner', () => {
  test('async：submit → jobId 落盘 → 轮询 → 整理 → 交付 .md', async () => {
    const p = fakeProvider({ poll: jest.fn().mockResolvedValueOnce({ state: 'pending' }).mockResolvedValueOnce({ state: 'running', progress: { done: 1, total: 2 } }).mockResolvedValueOnce({ state: 'done', result: { markdownUrl: 'x' } }) });
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
    expect(await h.runner.process('t1')).toEqual({ completed: true });
    const t = h.store.get('t1');
    expect(t).toMatchObject({ status: 'completed', progress: 100, jobId: 'fixture-job-1', taskId: 'fixture-job-1', filename: '2401.00001.md', downloadId: 22 });
    expect(h.deps.taskManager.updateTask).toHaveBeenCalledWith('t1', { progress: 50 });
    expect(h.deps.saveDeliverable.mock.calls[0][0].markdown).toContain('$x$');
    expect(h.deps.saveDeliverable.mock.calls[0][0].markdown).toContain('source: fake-a');
    expect(h.deps.notify).toHaveBeenCalledWith(expect.anything(), 'completed', '2401.00001.md', p);
    expect(h.deps.sleep).toHaveBeenCalledTimes(2);
  });

  test('zip 输出（MinerU 形态）：直接下载原始 ZIP，不整理', async () => {
    const p = fakeProvider({ id: 'mineru', output: 'zip', fetchResult: jest.fn(async (r) => ({ zipUrl: r.zipUrl })), poll: jest.fn(async () => ({ state: 'done', result: { zipUrl: 'https://cdn.invalid/a.zip' } })) });
    const h = makeHarness({ providers: [p], keys: { mineru: 'k' }, tasks: [{ id: 't1', provider: 'mineru' }] });
    await h.runner.process('t1');
    expect(h.deps.downloadUrl).toHaveBeenCalledWith('https://cdn.invalid/a.zip', '2401.00001.zip');
    expect(h.deps.saveDeliverable).not.toHaveBeenCalled();
    expect(h.store.get('t1')).toMatchObject({ status: 'completed', zipUrl: 'https://cdn.invalid/a.zip' });
    expect(h.deps.storage.incrementConversion).toHaveBeenCalledWith('mineru_api');
  });

  test('旧记录没 provider 字段 → 按 mineru 处理', async () => {
    const p = fakeProvider({ id: 'mineru', output: 'zip', fetchResult: async () => ({ zipUrl: 'z' }) });
    const h = makeHarness({ providers: [p], keys: { mineru: 'k' }, tasks: [{ id: 't1', provider: undefined }] });
    await h.runner.process('t1');
    expect(p.submit).toHaveBeenCalled();
  });

  test('同步 provider：不轮询，直接 await；超过 60s → TIMEOUT', async () => {
    jest.useFakeTimers();
    const p = fakeProvider({ mode: 'sync', poll: undefined, fetchResult: undefined, submit: jest.fn(() => new Promise(() => {})) });
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
    const run = h.runner.process('t1');
    await jest.advanceTimersByTimeAsync(60000);
    const r = await run;
    expect(r.error.code).toBe('TIMEOUT');
    expect(h.store.get('t1')).toMatchObject({ status: 'failed', errorCode: 'TIMEOUT' });
    jest.useRealTimers();
    const ok = fakeProvider({ mode: 'sync', poll: undefined, fetchResult: undefined, submit: jest.fn(async () => ({ result: { markdown: 'm' } })) });
    const h2 = makeHarness({ providers: [ok], tasks: [{ id: 't2' }] });
    expect(await h2.runner.process('t2')).toEqual({ completed: true });
  });

  test('没 Key → AUTH_INVALID，不发请求', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], keys: {}, tasks: [{ id: 't1' }] });
    const r = await h.runner.process('t1');
    expect(r.error.code).toBe('AUTH_INVALID');
    expect(p.submit).not.toHaveBeenCalled();
  });

  test('provider 报 failed / 抛 ParseError → 记录统一错误码', async () => {
    const p = fakeProvider({ poll: jest.fn(async () => ({ state: 'failed', error: 'bad pdf' })) });
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
    await h.runner.process('t1');
    expect(h.store.get('t1')).toMatchObject({ status: 'failed', errorCode: 'PROVIDER_FAILED', errorReason: 'bad pdf' });
    const q = fakeProvider({ submit: jest.fn(async () => { throw new ParseError('QUOTA_EXCEEDED', { provider: 'fake-a', httpStatus: 403 }); }) });
    const h2 = makeHarness({ providers: [q], tasks: [{ id: 't1' }] });
    await h2.runner.process('t1');
    expect(h2.store.get('t1')).toMatchObject({ errorCode: 'QUOTA_EXCEEDED', errorHttpStatus: 403 });
  });

  test('超过 provider.timeoutMs → TIMEOUT', async () => {
    const p = fakeProvider({ timeoutMs: 3000, poll: jest.fn(async () => ({ state: 'running' })) });
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
    const r = await h.runner.process('t1');
    expect(r.error.code).toBe('TIMEOUT');
    expect(p.poll).toHaveBeenCalledTimes(4);
  });

  test('deletedTaskGuard：处理前 / 轮询中被删 → 停止且不交付', async () => {
    const h = makeHarness({ tasks: [{ id: 't1' }] });
    h.deleted.add('t1');
    expect(await h.runner.process('t1')).toEqual({ skipped: 'deleted' });
    const p = fakeProvider({ poll: jest.fn(async () => { h2.deleted.add('t2'); return { state: 'running' }; }) });
    const h2 = makeHarness({ providers: [p], tasks: [{ id: 't2' }] });
    expect(await h2.runner.process('t2')).toEqual({ skipped: 'deleted' });
    expect(h2.deps.saveDeliverable).not.toHaveBeenCalled();
  });

  test('未知 provider / 任务不存在 / 同一任务并发只跑一份', async () => {
    const h = makeHarness({ tasks: [{ id: 't1', provider: 'nope' }, { id: 't2' }] });
    expect((await h.runner.process('t1')).error.code).toBe('PROVIDER_FAILED');
    expect(await h.runner.process('zz')).toEqual({ skipped: 'missing' });
    const [a, b] = await Promise.all([h.runner.process('t2'), h.runner.process('t2')]);
    expect([a, b]).toContainEqual({ skipped: 'running' });
  });
});

describe('R4-11 background wiring', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '../src/background/index.js'), 'utf8');
  test('START_PDF_TASK 新消息 + 旧 START_MINERU_TASK(_FORCE) 别名；重复检查按 (arxivId, provider)', () => {
    expect(src).toMatch(/case 'START_PDF_TASK'/);
    expect(src).toMatch(/case 'START_MINERU_TASK':/);
    expect(src).toMatch(/case 'START_MINERU_TASK_FORCE':/);
    expect(src).toMatch(/findTaskByArxivId\(paperInfo\.arxivId, provider\)/);
  });
  test('taskManager.findTaskByArxivId 按 provider 过滤', async () => {
    const { installChrome } = require('./helpers/chrome-stubs');
    installChrome({ local: { mineruTasks: [{ id: 'a', paperInfo: { arxivId: '1' } }, { id: 'b', provider: 'paddleocr', paperInfo: { arxivId: '1' } }] } });
    const tm = require('../src/core/task-manager').default;
    expect((await tm.findTaskByArxivId('1', 'paddleocr')).id).toBe('b');
    expect((await tm.findTaskByArxivId('1', 'mineru')).id).toBe('a');
    expect((await tm.findTaskByArxivId('1')).id).toBe('a');
    expect(await tm.findTaskByArxivId('2', 'mineru')).toBeNull();
  });
});
