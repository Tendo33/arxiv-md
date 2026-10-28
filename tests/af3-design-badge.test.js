/**
 * AF3 设计验收：工具栏徽标配色与文字色
 */
import { BADGE, createActionBadge } from '../src/background/action-badge';

const timers = { setTimeout: () => 1, clearTimeout: () => {} };

function mockAction({ withTextColor = true } = {}) {
  const log = [];
  const api = {
    setBadgeText: (o) => log.push(['text', o]),
    setBadgeBackgroundColor: (o) => log.push(['bg', o]),
  };
  if (withTextColor) api.setBadgeTextColor = (o) => log.push(['fg', o]);
  return { api, log };
}

describe('AF3 设计验收：徽标', () => {
  test('warning：⚠，底色 #f59e0b，文字色 #1f1300', () => {
    expect(BADGE.warning).toEqual({ text: '⚠', color: '#f59e0b', textColor: '#1f1300' });
    const { api, log } = mockAction();
    const b = createActionBadge(api, timers);
    b.shortcutStarted(7);
    log.length = 0;
    b.finish(7, 'warning');
    expect(log).toContainEqual(['bg', { tabId: 7, color: '#f59e0b' }]);
    expect(log).toContainEqual(['fg', { tabId: 7, color: '#1f1300' }]);
    expect(log).toContainEqual(['text', { tabId: 7, text: '⚠' }]);
  });

  test.each(['running', 'success', 'error'])('%s 显式设文字色 #ffffff', (state) => {
    expect(BADGE[state].textColor).toBe('#ffffff');
    const { api, log } = mockAction();
    const b = createActionBadge(api, timers);
    if (state === 'running') b.shortcutStarted(3);
    else if (state === 'error') b.fail(3);
    else { b.shortcutStarted(3); log.length = 0; b.finish(3, true); }
    expect(log).toContainEqual(['fg', { tabId: 3, color: '#ffffff' }]);
  });

  test('没有 setBadgeTextColor 时不抛错，照常设底色和文字', () => {
    const { api, log } = mockAction({ withTextColor: false });
    // 被 safeCall 吞掉的错误也要看见：去掉存在性检查时这里会收到 TypeError
    const swallowed = [];
    const b = createActionBadge(api, timers, { onError: (e) => swallowed.push(e) });
    b.shortcutStarted(5);
    expect(() => b.finish(5, 'warning')).not.toThrow();
    expect(swallowed).toEqual([]);
    expect(log).toContainEqual(['bg', { tabId: 5, color: '#f59e0b' }]);
    expect(log).toContainEqual(['text', { tabId: 5, text: '⚠' }]);
    expect(log.some(([k]) => k === 'fg')).toBe(false);
  });

  test('onError 能观察到被吞掉的同步错误（保证上一条用例有效）', () => {
    const swallowed = [];
    const api = { setBadgeText: () => { throw new Error('tab closed'); }, setBadgeBackgroundColor: () => {} };
    const b = createActionBadge(api, timers, { onError: (e) => swallowed.push(e) });
    b.shortcutStarted(1);
    expect(swallowed.length).toBeGreaterThan(0);
  });
});
