/**
 * A2-01 回归：不注入假 timers，走默认实现。
 * Chrome 里脱离 globalThis 调用 setTimeout 会抛 "Illegal invocation"，这里在 node 环境模拟。
 */
import { createActionBadge } from '../src/background/action-badge';
import { triggerConversionInActiveTab } from '../src/background/message-guards';

const realSet = globalThis.setTimeout;
const realClear = globalThis.clearTimeout;

const live = new Set();
function strictTimer(real, track) {
  return function strict(...args) {
    if (this !== globalThis && this !== undefined) throw new TypeError('Illegal invocation');
    const id = real.apply(globalThis, args);
    if (track) live.add(id);
    return id;
  };
}

beforeEach(() => {
  globalThis.setTimeout = strictTimer(realSet, true);
  globalThis.clearTimeout = strictTimer(realClear, false);
});
afterEach(() => {
  live.forEach((id) => realClear(id)); // 徽标的 120 秒清除计时器别拖住 jest
  live.clear();
  globalThis.setTimeout = realSet;
  globalThis.clearTimeout = realClear;
});

const action = () => ({ setBadgeText: jest.fn(), setBadgeBackgroundColor: jest.fn() });

describe('A2-01：默认 timers 不得脱离 globalThis', () => {
  test('默认 timers 下 shortcutStarted / finish 不抛错', () => {
    const badge = createActionBadge(action());
    expect(() => badge.shortcutStarted(1)).not.toThrow();
    expect(() => badge.finish(1, true)).not.toThrow();
    expect(() => badge.shortcutUndelivered(1)).not.toThrow();
  });

  test('默认 timers 下快捷键仍发出 TRIGGER_CONVERSION', () => {
    const badge = createActionBadge(action());
    const tabsApi = {
      query: (_q, cb) => cb([{ id: 7 }]),
      sendMessage: jest.fn(),
    };
    triggerConversionInActiveTab(tabsApi, {}, () => {}, { onSent: (id) => badge.shortcutStarted(id) });
    expect(tabsApi.sendMessage).toHaveBeenCalledWith(7, { type: 'TRIGGER_CONVERSION' }, expect.any(Function));
  });
});

describe('A2-01：徽标出错不阻断转换', () => {
  test('onSent 抛错时 sendMessage 仍执行', () => {
    const tabsApi = { query: (_q, cb) => cb([{ id: 3 }]), sendMessage: jest.fn() };
    const log = jest.fn();
    expect(() => triggerConversionInActiveTab(tabsApi, {}, log, {
      onSent: () => { throw new Error('badge boom'); },
    })).not.toThrow();
    expect(tabsApi.sendMessage).toHaveBeenCalledTimes(1);
  });

  test('actionApi 返回 rejected Promise 或同步抛错时不抛、不留未处理 rejection', async () => {
    const rejecting = {
      setBadgeText: jest.fn(() => Promise.reject(new Error('No tab with id'))),
      setBadgeBackgroundColor: jest.fn(() => Promise.reject(new Error('No tab with id'))),
    };
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    const badge = createActionBadge(rejecting);
    expect(() => { badge.shortcutStarted(1); badge.finish(1, false); }).not.toThrow();
    const throwing = { setBadgeText: () => { throw new Error('x'); }, setBadgeBackgroundColor: () => { throw new Error('x'); } };
    const b2 = createActionBadge(throwing);
    expect(() => { b2.shortcutStarted(2); b2.shortcutUndelivered(2); }).not.toThrow();
    await new Promise((r) => realSet(r, 10));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
