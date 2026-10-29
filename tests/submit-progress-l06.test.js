// QA L-06：提交阶段（可能 ~100 s）就开始计时并显示非 0 进度
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
import { makeHarness, fakeProvider } from './helpers/runner-harness';

test('submit 进行中：任务已有 startedAt、progress > 0；拿到 jobId 后 startedAt 不被推迟', async () => {
  const p = fakeProvider();
  const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
  let during;
  const orig = p.submit.getMockImplementation();
  p.submit.mockImplementation(async (...a) => { during = { ...h.store.get('t1') }; return orig(...a); });
  const { createParseTaskRunner } = require('../src/background/parse-task-runner');
  await createParseTaskRunner(h.deps).process('t1');
  expect(during.startedAt).toEqual(expect.any(Number));
  expect(during.progress).toBeGreaterThan(0);
  expect(h.store.get('t1').startedAt).toBe(during.startedAt);
});
