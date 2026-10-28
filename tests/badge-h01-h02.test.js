// QA H-01 / H-02（qa-hotfix-badge-timers-2026-10-28.md）：转换返回 {success:false} 时徽标「!」；
// content 侧离线 / 元数据失败提前结束时也上报 SHORTCUT_RESULT，徽标「!」并 6 秒后清除
import fs from 'fs';
import path from 'path';
import { createActionBadge, handleShortcutResult, conversionSucceeded } from '../src/background/action-badge';

const mkAction = () => {
  const state = {};
  return { state,
    setBadgeText: jest.fn(({ tabId, text }) => { state[tabId] = { ...state[tabId], text }; return Promise.resolve(); }),
    setBadgeBackgroundColor: jest.fn(() => Promise.resolve()) };
};

describe('H-01 conversionSucceeded', () => {
  test.each([
    [{ success: false, error: 'NETWORK_OFFLINE' }, false],
    [{ success: false }, false],
    [undefined, false],
    [null, false],
    [{ success: true }, true],
    [{ taskId: 'x' }, true],
    [{ success: false, duplicate: true }, false],
  ])('%p → %p', (r, ok) => expect(conversionSucceeded(r)).toBe(ok));
});

describe('H-01 background/index.js 接线：CONVERT_PAPER 返回 success:false → 「!」', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/background/index.js'), 'utf8');
  test('handleConvertPaper 按 result 决定徽标，不再固定 finish(tabId, true)', () => {
    expect(src).toMatch(/if \(result && result\.duplicate\) actionBadge\.hold\(tabId\);\s*else actionBadge\.finish\(tabId, conversionSucceeded\(result\)\)/);
    expect(src).not.toMatch(/actionBadge\.finish\(tabId, true\)/);
  });
  test('端到端：SW 侧 fetch 失败 → 转换返回失败 → 徽标「!」，6000 ms 后清除', async () => {
    const listeners = {}; const action = mkAction(); const pending = [];
    const ev = (n) => ({ addListener: (fn) => { listeners[n] = fn; } });
    global.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    global.chrome = {
      runtime: { id: 'me', onMessage: ev('message'), onInstalled: ev('installed'), onStartup: ev('startup'), getURL: (p) => p, sendMessage: () => Promise.resolve() },
      action,
      tabs: { onUpdated: ev('tabUpdated'), query: (_q, cb) => cb([{ id: 21, url: 'https://arxiv.org/abs/1810.04805' }]), sendMessage: (_i, _m, cb) => { cb && cb({ ok: true }); return Promise.resolve({}); }, onRemoved: ev('tabRemoved') },
      commands: { onCommand: ev('command') },
      alarms: { onAlarm: ev('alarm'), create: () => {}, clear: async () => true, get: async () => null },
      storage: { local: { get: async () => ({}), set: async () => {} }, sync: { get: async () => ({}), set: async () => {} }, onChanged: ev('storage') },
      downloads: { download: async () => { throw new Error('download failed'); } },
      notifications: { onClicked: ev('notif'), create: () => {} },
    };
    const realSetTimeout = global.setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms, ...a) => { if (ms >= 4000) { pending.push([fn, ms]); return 0; } return realSetTimeout(fn, ms, ...a); });
    jest.isolateModules(() => { require('../src/background/index.js'); });
    await listeners.command('convert-current-paper');
    await new Promise((r) => realSetTimeout(r, 10));
    expect(action.state[21].text).toBe('…');
    const resp = await new Promise((resolve) => {
      listeners.message({ type: 'CONVERT_PAPER', data: { arxivId: '1810.04805', title: 'BERT', mode: 'markdown' } }, { id: 'me', tab: { id: 21 } }, resolve);
    });
    await new Promise((r) => realSetTimeout(r, 10));
    expect(resp).toBeTruthy();
    expect(action.state[21].text).toBe('!');
    const clear = pending.find(([, ms]) => ms === 6000);
    expect(clear).toBeTruthy();
    clear[0]();
    expect(action.state[21].text).toBe('');
    global.setTimeout.mockRestore();
  }, 20000);
});

describe('H-02 content 提前失败上报 SW', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/content/index.js'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '../src/content/progress-ui.js'), 'utf8');
  test('离线分支走 showError（它会上报 SHORTCUT_RESULT），不是静默 return', () => {
    const m = src.match(/navigator\.onLine === false\) \{([\s\S]*?)return;/);
    expect(m).toBeTruthy();
    expect(m[1]).toMatch(/showError\(t\.content_error_offline\)/);
  });
  test('showError 调用 reportShortcutFailure → SHORTCUT_RESULT ok:false', () => {
    const body = ui.match(/export function showError[\s\S]*?\n}\n/)[0];
    expect(body).toMatch(/reportShortcutFailure\(\)/);
    expect(ui).toMatch(/export function reportShortcutFailure\(\) \{ sendShortcutResult\(\{ ok: false \}\); \}/);
    expect(ui).toMatch(/sendMessage\(\{ type: 'SHORTCUT_RESULT', \.\.\.extra \}\)/);
  });
  test('SW 收到后「…」→「!」，6000 ms 后清除（离线 / 元数据失败同一路径）', () => {
    const a = mkAction(); const t = [];
    const badge = createActionBadge(a, { setTimeout: (fn, ms) => { t.push([fn, ms]); return t.length; }, clearTimeout: () => {} });
    badge.shortcutStarted(5);
    expect(handleShortcutResult(badge, { ok: false }, { id: 'me', tab: { id: 5 } }, 'me')).toBe(true);
    expect(a.state[5].text).toBe('!');
    const c = t.filter(([, ms]) => ms === 6000).pop();
    expect(c).toBeTruthy(); c[0]();
    expect(a.state[5].text).toBe('');
  });
});
