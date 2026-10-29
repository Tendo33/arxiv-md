// 审查 P3-4（review-paddleocr-parity-6a49976）：dnrReinitWaitSince / dnrAutoReinit 以前从不清除。
// 手动重试 → 两个字段都清；进入 PROCESSING → 清 dnrReinitWaitSince。
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
import { makeHarness, fakeProvider } from './helpers/runner-harness';
import { loadBackground, flush } from './helpers/bg-harness';

test('RETRY_TASK 把 dnrReinitWaitSince 和 dnrAutoReinit 置 null', async () => {
  const b = loadBackground();
  const task = { id: 't1', status: 'failed', dnrReinitWaitSince: 123, dnrAutoReinit: true };
  jest.spyOn(b.tm, 'getTask').mockResolvedValue(task);
  const upd = jest.spyOn(b.tm, 'updateTask').mockResolvedValue(task);
  expect(await b.send({ type: 'RETRY_TASK', taskId: 't1' })).toEqual({ success: true });
  const patch = upd.mock.calls.find(([id]) => id === 't1')[1];
  expect(patch).toMatchObject({ status: 'pending', dnrReinitWaitSince: null, dnrAutoReinit: null });
  await flush();
  expect(b.proc).toHaveBeenCalledWith('t1');
});

test('进入 PROCESSING 时清掉 dnrReinitWaitSince（dnrAutoReinit 保留，防止反复重载）', async () => {
  const h = makeHarness({ providers: [fakeProvider()], tasks: [{ id: 't1', dnrReinitWaitSince: 5, dnrAutoReinit: true }] });
  const { createParseTaskRunner } = require('../src/background/parse-task-runner');
  const seen = [];
  const upd = h.deps.taskManager.updateTask;
  h.deps.taskManager.updateTask = jest.fn(async (id, patch) => { if (patch.status === 'processing') seen.push(patch); return upd(id, patch); });
  expect(await createParseTaskRunner(h.deps).process('t1')).toEqual({ completed: true });
  expect(seen).toHaveLength(1);
  expect(seen[0]).toHaveProperty('dnrReinitWaitSince', null);
  expect(h.store.get('t1').dnrReinitWaitSince).toBeNull();
  expect(h.store.get('t1').dnrAutoReinit).toBe(true);
});
