import { createActionBadge, BADGE, BADGE_CLEAR_MS } from '../src/background/action-badge';
import { triggerConversionInActiveTab } from '../src/background/message-guards';

function stub() {
  const state = {};
  const timers = [];
  const action = {
    setBadgeText: ({ tabId, text }) => { state[tabId] = { ...state[tabId], text }; },
    setBadgeBackgroundColor: ({ tabId, color }) => { state[tabId] = { ...state[tabId], color }; },
  };
  const t = {
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].fn = () => {}; },
  };
  return { state, timers, action, t };
}

describe('Round 2 审查：快捷键转换的工具栏徽标反馈', () => {
  test('进行中 → 成功，几秒后自动清除', () => {
    const { state, timers, action, t } = stub();
    const badge = createActionBadge(action, t);
    badge.shortcutStarted(5);
    expect(state[5]).toEqual({ text: BADGE.running.text, color: BADGE.running.color });
    expect(badge.finish(5, true)).toBe(true);
    expect(state[5]).toEqual({ text: '✓', color: BADGE.success.color });
    const last = timers[timers.length - 1];
    expect(last.ms).toBe(BADGE_CLEAR_MS.success);
    expect(last.ms).toBeLessThanOrEqual(6000);
    timers.forEach((x) => x.fn());
    expect(state[5].text).toBe('');
  });

  test('失败显示红色 !，旧的“进行中”定时器不会提前清掉结果', () => {
    const { state, timers, action, t } = stub();
    const badge = createActionBadge(action, t);
    badge.shortcutStarted(9);
    badge.finish(9, false);
    expect(state[9]).toEqual({ text: '!', color: BADGE.error.color });
    timers[0].fn(); // running 的定时器已被 clearTimeout 作废
    expect(state[9].text).toBe('!');
    timers[1].fn();
    expect(state[9].text).toBe('');
  });

  test('不是快捷键发起的转换（页内按钮）不动徽标', () => {
    const { state, action, t } = stub();
    const badge = createActionBadge(action, t);
    expect(badge.finish(3, true)).toBe(false);
    expect(state[3]).toBeUndefined();
  });

  test('消息没送到（非 arXiv 页）立即清除徽标', () => {
    const { state, action, t } = stub();
    const badge = createActionBadge(action, t);
    const tabs = {
      query: (_q, cb) => cb([{ id: 11 }]),
      sendMessage: () => Promise.reject(new Error('Could not establish connection')),
    };
    triggerConversionInActiveTab(tabs, {}, () => {}, {
      onSent: (id) => badge.shortcutStarted(id),
      onUndelivered: (id) => badge.shortcutUndelivered(id),
    });
    expect(state[11].text).toBe('…');
    return Promise.resolve().then(() => {
      expect(state[11].text).toBe('');
      expect(badge.isTracking(11)).toBe(false);
    });
  });
});
