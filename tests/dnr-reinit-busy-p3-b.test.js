/** 审查 P3-b：dnr-reinit.js 的 busy 检查——没有扩展页面开着、但还有解析任务在跑（isIdle()=false）时不能重载 */
import { scheduleReloadWhenIdle, _resetDnrReinitForTests } from '../src/background/dnr-reinit';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mkChrome = () => ({ runtime: { reload: jest.fn(), getContexts: jest.fn(async () => []) } });

beforeEach(() => _resetDnrReinitForTests());

test('没有页面但 isIdle()=false → 不重载；变成空闲后才重载一次，且先调 beforeReload', async () => {
  const c = mkChrome();
  let idle = false;
  const before = jest.fn();
  scheduleReloadWhenIdle({ isIdle: () => idle, beforeReload: before }, c, { intervalMs: 5 });
  await tick(30);
  expect(c.runtime.reload).not.toHaveBeenCalled();
  expect(before).not.toHaveBeenCalled();
  idle = true;
  await tick(30);
  expect(before).toHaveBeenCalledTimes(1);
  expect(c.runtime.reload).toHaveBeenCalledTimes(1);
});

test('多个排队方里只要有一个忙就不重载', async () => {
  const c = mkChrome();
  let busy2 = true;
  scheduleReloadWhenIdle({ isIdle: () => true }, c, { intervalMs: 5 });
  scheduleReloadWhenIdle({ isIdle: () => !busy2 }, c, { intervalMs: 5 });
  await tick(30);
  expect(c.runtime.reload).not.toHaveBeenCalled();
  busy2 = false;
  await tick(30);
  expect(c.runtime.reload).toHaveBeenCalledTimes(1);
});

test('没写 isIdle 的排队方视为空闲', async () => {
  const c = mkChrome();
  scheduleReloadWhenIdle({}, c, { intervalMs: 5 });
  await tick(20);
  expect(c.runtime.reload).toHaveBeenCalledTimes(1);
});
