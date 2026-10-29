// release-polish AR-09：徽标的清除计时器（running 最长 120 秒）不能拖住 jest 进程退出
import { defaultTimers, createActionBadge } from '../src/background/action-badge';

test('defaultTimers.setTimeout 在 Node 里返回已 unref 的计时器，仍能 clear', () => {
  const id = defaultTimers.setTimeout(() => {}, 120000);
  expect(typeof id.hasRef).toBe('function');
  expect(id.hasRef()).toBe(false);
  defaultTimers.clearTimeout(id);
});

test('计时器仍会按时触发（unref 不影响回调）', async () => {
  const fn = jest.fn();
  defaultTimers.setTimeout(fn, 5);
  await new Promise((r) => setTimeout(r, 30));
  expect(fn).toHaveBeenCalled();
});

test('默认计时器下快捷键徽标的 120 秒清除计时器不保持进程', () => {
  const action = { setBadgeText: jest.fn(), setBadgeBackgroundColor: jest.fn() };
  const spy = jest.spyOn(global, 'setTimeout');
  createActionBadge(action).shortcutStarted(1);
  const call = spy.mock.results.find((r, i) => spy.mock.calls[i][1] === 120000);
  spy.mockRestore();
  expect(call.value.hasRef()).toBe(false);
  clearTimeout(call.value);
});
