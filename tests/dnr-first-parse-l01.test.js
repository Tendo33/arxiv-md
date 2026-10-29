// QA L-01（第二版）：确认数据说明 / 授权后立即解析——不在用户眼前重载扩展
// - 规则在提交前的核对 / 重装里就绪 → 直接成功，runtime.reload 一次都不调
// - DNR 调用挂起（Chromium 同会话刚授权的真实情况）→ 任务保持 PENDING；设置页 / popup 开着时不重载，关掉后才重载一次
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
import { makeHarness, fakeProvider } from './helpers/runner-harness';
import { requirePaddleOriginRule, PADDLE_ORIGIN_RULE_ID } from '../src/background/paddle-origin-rule';
import { scheduleReloadWhenIdle, _resetDnrReinitForTests } from '../src/background/dnr-reinit';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function fakeChrome({ hang = false } = {}) {
  let rules = [];
  const c = {
    state: { hang, pages: [] },
    permissions: { contains: async () => true },
    declarativeNetRequest: {
      getDynamicRules: jest.fn(() => (c.state.hang ? new Promise(() => {}) : Promise.resolve(rules))),
      updateDynamicRules: jest.fn((o) => (c.state.hang ? new Promise(() => {}) : Promise.resolve(void (rules = o.addRules || [])))),
    },
    runtime: { id: 'extid', reload: jest.fn(), getContexts: jest.fn(async () => c.state.pages) },
  };
  return c;
}

function setup(c) {
  _resetDnrReinitForTests();
  const p = fakeProvider();
  const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
  h.deps.beforeSubmit = () => requirePaddleOriginRule(c, { timeoutMs: 30, retryDelayMs: 1 });
  h.deps.reinit = (o) => scheduleReloadWhenIdle(o, c, { intervalMs: 5 });
  const statuses = [];
  const upd = h.deps.taskManager.updateTask;
  h.deps.taskManager.updateTask = jest.fn(async (id, patch) => { if (patch.status) statuses.push(patch.status); return upd(id, patch); });
  const { createParseTaskRunner } = require('../src/background/parse-task-runner');
  return { p, h, statuses, runner: () => createParseTaskRunner(h.deps) };
}

test('首次确认后立即解析：规则在提交前核对 / 重装后就绪 → 成功，且没有调用 runtime.reload', async () => {
  const c = fakeChrome();
  const s = setup(c);
  const r = await s.runner().process('t1');
  expect(r).toEqual({ completed: true });
  expect(c.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(1);
  expect((await c.declarativeNetRequest.getDynamicRules()).map((x) => x.id)).toEqual([PADDLE_ORIGIN_RULE_ID]);
  expect(s.p.submit).toHaveBeenCalledTimes(1);
  expect(c.runtime.reload).not.toHaveBeenCalled();
  expect(s.statuses).not.toContain('failed');
});

test('DNR 挂起：设置页开着时不重载、任务保持 PENDING；页面关掉后重载一次，重载后续跑成功', async () => {
  const c = fakeChrome({ hang: true });
  c.state.pages = [{ contextType: 'TAB', documentUrl: 'chrome-extension://extid/settings.html' }];
  const s = setup(c);
  expect(await s.runner().process('t1')).toEqual({ reinit: true });
  await tick(40);
  expect(c.runtime.reload).not.toHaveBeenCalled();
  expect(s.h.store.get('t1').status).toBe('pending');
  expect(s.p.submit).not.toHaveBeenCalled();
  c.state.pages = [];
  await tick(30);
  expect(c.runtime.reload).toHaveBeenCalledTimes(1);
  expect(s.h.store.get('t1').dnrAutoReinit).toBe(true);
  c.state.hang = false; // 重载后 DNR 恢复
  await s.runner().process('t1');
  expect(s.p.submit).toHaveBeenCalledTimes(1);
  expect(s.statuses).not.toContain('failed');
});

test('重载后仍没就绪 → 照常失败（dnr_not_ready），只重载一次', async () => {
  const c = fakeChrome({ hang: true });
  const s = setup(c);
  await s.runner().process('t1');
  await tick(30);
  expect(c.runtime.reload).toHaveBeenCalledTimes(1);
  await s.runner().process('t1');
  await tick(30);
  expect(c.runtime.reload).toHaveBeenCalledTimes(1);
  expect(s.h.store.get('t1')).toMatchObject({ status: 'failed', errorReason: 'dnr_not_ready' });
});

test('页面一直开着超过上限 → 失败，不重载', async () => {
  const c = fakeChrome({ hang: true });
  c.state.pages = [{ contextType: 'POPUP' }];
  const s = setup(c);
  await s.runner().process('t1');
  const { DNR_REINIT_MAX_WAIT_MS } = require('../src/background/parse-task-runner');
  s.h.advance(DNR_REINIT_MAX_WAIT_MS + 1);
  await s.runner().process('t1');
  expect(s.h.store.get('t1')).toMatchObject({ status: 'failed', errorReason: 'dnr_not_ready' });
  expect(c.runtime.reload).not.toHaveBeenCalled();
  _resetDnrReinitForTests();
});

test('没有 reinit 依赖（旧行为）→ 直接失败', async () => {
  const c = fakeChrome({ hang: true });
  const s = setup(c);
  delete s.h.deps.reinit;
  await s.runner().process('t1');
  expect(s.h.store.get('t1').status).toBe('failed');
});
