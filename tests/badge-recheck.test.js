// Round 2 复审建议 1–4：content 侧提前失败也能结束徽标、Promise reject 不外泄、
// 页面跳转清徽标、index.js 接线有守护、time-ago 容错
import { createActionBadge, handleShortcutResult } from '../src/background/action-badge';
import { formatTimeAgo } from '../src/utils/time-ago';

const mkAction = () => {
  const state = {};
  return {
    state,
    setBadgeText: jest.fn(({ tabId, text }) => { state[tabId] = { ...state[tabId], text }; return Promise.resolve(); }),
    setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
  };
};
const timers = { setTimeout: () => 1, clearTimeout: () => {} };

test('SHORTCUT_RESULT 只接受本扩展 content 的消息，并把「…」换成「!」', () => {
  const a = mkAction(); const badge = createActionBadge(a, timers);
  badge.shortcutStarted(3);
  expect(handleShortcutResult(badge, { ok: false }, { id: 'other', tab: { id: 3 } }, 'me')).toBe(false);
  expect(handleShortcutResult(badge, { ok: false }, { id: 'me' }, 'me')).toBe(false);
  expect(handleShortcutResult(badge, { ok: false }, { id: 'me', tab: { id: 3 } }, 'me')).toBe(true);
  expect(a.state[3].text).toBe('!');
  // 非快捷键发起的转换不显示徽标
  expect(handleShortcutResult(badge, { ok: false }, { id: 'me', tab: { id: 9 } }, 'me')).toBe(false);
});

test('tab 已关闭时 setBadgeText 返回 rejected Promise，不产生未处理 rejection', async () => {
  const onUnhandled = jest.fn();
  process.on('unhandledRejection', onUnhandled);
  const a = { setBadgeText: () => Promise.reject(new Error('No tab with id: 4')), setBadgeBackgroundColor: () => Promise.reject(new Error('No tab')) };
  const badge = createActionBadge(a, timers);
  badge.shortcutStarted(4); badge.finish(4, false); badge.tabLoading(4);
  await new Promise((r) => setTimeout(r, 20));
  process.off('unhandledRejection', onUnhandled);
  expect(onUnhandled).not.toHaveBeenCalled();
});

test('页面开始加载时清掉残留徽标和跟踪', () => {
  const a = mkAction(); const badge = createActionBadge(a, timers);
  badge.shortcutStarted(6);
  badge.tabLoading(6);
  expect(a.state[6].text).toBe('');
  expect(badge.isTracking(6)).toBe(false);
});

test('time-ago：非有限时间戳显示占位「—」（基于 hotfix A2-02）而不是抛 RangeError', () => {
  expect(formatTimeAgo(undefined, 'zh', '刚刚')).toBe('—');
  expect(formatTimeAgo(NaN, 'en', 'Just now')).toBe('—');
  expect(formatTimeAgo('x', 'en', 'Just now')).toBe('—');
});

describe('background/index.js 接线', () => {
  let listeners;
  let action;
  beforeAll(() => {
    listeners = {};
    action = mkAction();
    const ev = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
    global.chrome = {
      runtime: { id: 'me', onMessage: ev('message'), onInstalled: ev('installed'), onStartup: ev('startup'), getURL: (p) => p, sendMessage: () => Promise.resolve() },
      action,
      tabs: { onUpdated: ev('tabUpdated'), query: async () => [], sendMessage: async () => ({}), onRemoved: ev('tabRemoved') },
      commands: { onCommand: ev('command') },
      alarms: { onAlarm: ev('alarm'), create: () => {}, clear: async () => true, get: async () => null },
      storage: { local: { get: async () => ({}), set: async () => {} }, sync: { get: async () => ({}), set: async () => {} }, onChanged: ev('storage') },
      downloads: { download: async () => 1 },
      notifications: { onClicked: ev('notif'), create: () => {} },
    };
    jest.isolateModules(() => { require('../src/background/index.js'); });
  });
  test('快捷键开始 → content 上报失败 → 徽标「!」；跳转后清除', async () => {
    expect(typeof listeners.message).toBe('function');
    expect(typeof listeners.tabUpdated).toBe('function');
    // 模拟快捷键：commands 监听会调 triggerConversionInActiveTab；这里直接走同一路径的结果
    chrome.tabs.query = (_q, cb) => cb([{ id: 11, url: 'https://arxiv.org/html/2301.00001' }]);
    chrome.tabs.sendMessage = (_id, _m, cb) => { cb && cb({ ok: true }); };
    await listeners.command('convert-current-paper');
    await new Promise((r) => setTimeout(r, 10));
    expect(action.state[11] && action.state[11].text).toBe('…');
    listeners.message({ type: 'SHORTCUT_RESULT', ok: false }, { id: 'me', tab: { id: 11 } }, () => {});
    expect(action.state[11].text).toBe('!');
    listeners.tabUpdated(11, { status: 'loading' });
    expect(action.state[11].text).toBe('');
  });
});

describe('content showError 上报 SHORTCUT_RESULT', () => {
  test('发出 ok:false；扩展已重载（sendMessage 抛错/reject）时不外泄异常', async () => {
    const { parseHTML } = require('linkedom');
    const { document, window } = parseHTML('<!doctype html><html><body><div class="arxiv-md-progress"><span class="progress-text"></span><div class="progress-detail"></div></div></body></html>');
    global.document = document; global.window = window;
    const sent = [];
    global.chrome = { runtime: { sendMessage: (m) => { sent.push(m); return Promise.reject(new Error('Extension context invalidated')); } } };
    const { showError } = require('../src/content/progress-ui');
    showError('offline');
    expect(sent).toEqual([{ type: 'SHORTCUT_RESULT', ok: false }]);
    global.chrome = { runtime: { sendMessage: () => { throw new Error('Extension context invalidated'); } } };
    expect(() => showError('x')).not.toThrow();
    await new Promise((r) => setTimeout(r, 5));
  });
});
