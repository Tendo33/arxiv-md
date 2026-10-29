import { makeHarness, fakeProvider } from './helpers/runner-harness';

describe('R4-12 SW 重启续跑', () => {
  test('有 jobId 的 processing 任务按 jobId 续轮询，不重新 submit', async () => {
    const h = makeHarness({ tasks: [{ id: 't1', status: 'processing', jobId: 'fixture-job-9', startedAt: 0 }, { id: 't2', status: 'completed' }] });
    const ids = await h.runner.resumeActiveTasks();
    expect(ids).toEqual(['t1']);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const p = h.registry.get('fake-a');
    expect(p.submit).not.toHaveBeenCalled();
    expect(p.poll.mock.calls[0][0]).toBe('fixture-job-9');
  });

  test('pending 无 jobId → 提交；重复唤醒不会重复处理', async () => {
    const h = makeHarness({ tasks: [{ id: 't1', status: 'pending' }] });
    const [a, b] = await Promise.all([h.runner.resumeActiveTasks(), h.runner.resumeActiveTasks()]);
    expect([...a, ...b].length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
    expect(h.registry.get('fake-a').submit).toHaveBeenCalledTimes(1);
  });

  test('超过 startedAt + timeoutMs 的任务续上后判超时失败', async () => {
    const p = fakeProvider({ poll: jest.fn(async () => ({ state: 'running' })) });
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1', status: 'processing', jobId: 'fixture-job-9', startedAt: 0 }], clock: () => 10 ** 9 });
    await h.runner.process('t1');
    expect(h.store.get('t1')).toMatchObject({ status: 'failed', errorCode: 'TIMEOUT' });
  });
});
