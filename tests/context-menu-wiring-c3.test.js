// C-3 审查建议 2/3：右键菜单接线（index.js 的 onInstalled/onStartup/onClicked）、链接导出监听的清理与失败徽标、
// 设置页实际调用 bindInstantSave。删掉任一接线，这里都会失败。
jest.mock('@core/converter', () => ({ __esModule: true, default: { convert: jest.fn() } }));
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createContextMenus, MENU } from '../src/background/context-menu';
import { createActionBadge } from '../src/background/action-badge';

const flush = () => new Promise((r) => setTimeout(r, 10));

function mkEvent() {
  const fns = [];
  return { fns, addListener: jest.fn((f) => fns.push(f)), removeListener: jest.fn((f) => { const i = fns.indexOf(f); if (i >= 0) fns.splice(i, 1); }), fire: (...a) => [...fns].forEach((f) => f(...a)) };
}

describe('index.js 接线', () => {
  let ev; let created;
  const boot = () => {
    ev = {}; created = [];
    const e = (n) => { ev[n] = mkEvent(); return ev[n]; };
    global.chrome = {
      runtime: { id: 'me', onMessage: e('message'), onInstalled: e('installed'), onStartup: e('startup'), getURL: (p) => p, sendMessage: () => Promise.resolve(), lastError: null },
      action: { setBadgeText: jest.fn(async () => {}), setBadgeBackgroundColor: jest.fn(async () => {}) },
      tabs: { onUpdated: e('tabUpdated'), onRemoved: e('tabRemoved'), query: jest.fn(async () => []), sendMessage: jest.fn(async () => ({})), create: jest.fn(async (o) => ({ id: 77, status: 'loading', ...o })) },
      commands: { onCommand: e('command'), getAll: async () => [] },
      alarms: { onAlarm: e('alarm'), create: () => {}, clear: async () => true, get: async () => null },
      storage: { local: { get: async () => ({}), set: async () => {} }, sync: { get: async () => ({}), set: async () => {} }, onChanged: e('storage') },
      downloads: { download: async () => 1 },
      notifications: { onClicked: e('notif'), create: () => {} },
      contextMenus: { create: jest.fn((item) => created.push(item)), removeAll: jest.fn((cb) => { created = []; cb && cb(); }), onClicked: e('menu') },
    };
    jest.isolateModules(() => { require('../src/background/index.js'); });
  };

  test('onInstalled / onStartup 重建菜单', async () => {
    boot(); await flush();
    expect(ev.installed.fns.length).toBeGreaterThan(0);
    await Promise.all(ev.installed.fns.map((f) => f({ reason: 'install' })));
    await flush();
    expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
    expect(created.map((i) => i.id)).toEqual(expect.arrayContaining([MENU.PAGE, MENU.LINK]));
    chrome.contextMenus.removeAll.mockClear(); created = [];
    await Promise.all(ev.startup.fns.map((f) => f()));
    await flush();
    expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
    expect(created.length).toBeGreaterThan(0);
  });

  test('contextMenus.onClicked 已注册并分发到本页转换', async () => {
    boot(); await flush();
    expect(ev.menu.fns).toHaveLength(1);
    ev.menu.fire({ menuItemId: MENU.PAGE }, { id: 42, url: 'https://arxiv.org/abs/2301.00001' });
    await flush();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, expect.objectContaining({ type: 'TRIGGER_CONVERSION', mode: 'markdown' }));
  });
});

describe('链接导出：监听清理、超时与失败徽标', () => {
  const setup = ({ status = 'loading', create, sendMessage } = {}) => {
    const onUpdated = mkEvent(); const onRemoved = mkEvent();
    const timers = { pending: [], setTimeout: jest.fn((f) => { timers.pending.push(f); return timers.pending.length; }), clearTimeout: jest.fn() };
    const tabs = { onUpdated, onRemoved, create: create || jest.fn(async (o) => ({ id: 9, status })), sendMessage: sendMessage || jest.fn(async () => ({})) };
    const badge = { shortcutStarted: jest.fn(), shortcutUndelivered: jest.fn(), fail: jest.fn() };
    const cm = createContextMenus({ menus: {}, tabs, runtime: {}, storage: {}, isValidArxivId: () => true, badge, timers, loadTimeoutMs: 1000 });
    return { cm, tabs, onUpdated, onRemoved, timers, badge };
  };
  const opener = { id: 1, index: 0 };

  test('监听在 create 之前挂上；complete 后移除并触发转换', async () => {
    const s = setup();
    s.tabs.create.mockImplementation(async (o) => { expect(s.onUpdated.fns).toHaveLength(1); return { id: 9, status: 'loading', ...o }; });
    const p = s.cm.exportLink('2301.00001', opener);
    await flush();
    s.onUpdated.fire(5, { status: 'complete' }); // 别的标签页
    expect(s.tabs.sendMessage).not.toHaveBeenCalled();
    s.onUpdated.fire(9, { status: 'complete' });
    await expect(p).resolves.toEqual({ ok: true, tabId: 9 });
    expect(s.onUpdated.fns).toHaveLength(0);
    expect(s.onRemoved.fns).toHaveLength(0);
    expect(s.timers.clearTimeout).toHaveBeenCalled();
    expect(s.badge.fail).not.toHaveBeenCalled();
  });

  test('create 返回时已 complete，直接触发', async () => {
    const s = setup({ status: 'complete' });
    await expect(s.cm.exportLink('2301.00001', opener)).resolves.toEqual({ ok: true, tabId: 9 });
    expect(s.onUpdated.fns).toHaveLength(0);
  });

  test('超时：移除监听并在发起页显示 "!"', async () => {
    const s = setup();
    const p = s.cm.exportLink('2301.00001', opener);
    await flush();
    expect(s.timers.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    s.timers.pending[0]();
    await expect(p).resolves.toEqual(expect.objectContaining({ ok: false, reason: 'timeout' }));
    expect(s.onUpdated.fns).toHaveLength(0);
    expect(s.onRemoved.fns).toHaveLength(0);
    expect(s.badge.fail).toHaveBeenCalledWith(1);
    expect(s.tabs.sendMessage).not.toHaveBeenCalled();
  });

  test('加载中被关闭：移除监听并显示 "!"', async () => {
    const s = setup();
    const p = s.cm.exportLink('2301.00001', opener);
    await flush();
    s.onRemoved.fire(9);
    await expect(p).resolves.toEqual(expect.objectContaining({ ok: false, reason: 'closed' }));
    expect(s.onUpdated.fns).toHaveLength(0);
    expect(s.badge.fail).toHaveBeenCalledWith(1);
  });

  test('create 失败：移除监听并显示 "!"', async () => {
    const s = setup({ create: jest.fn(async () => { throw new Error('nope'); }) });
    await expect(s.cm.exportLink('2301.00001', opener)).resolves.toEqual(expect.objectContaining({ ok: false }));
    expect(s.onUpdated.fns).toHaveLength(0);
    expect(s.onRemoved.fns).toHaveLength(0);
    expect(s.badge.fail).toHaveBeenCalledWith(1);
  });

  test('消息送不到：显示 "!"', async () => {
    const s = setup({ status: 'complete', sendMessage: jest.fn(async () => { throw new Error('no receiver'); }) });
    await expect(s.cm.exportLink('2301.00001', opener)).resolves.toEqual(expect.objectContaining({ ok: false, reason: 'undelivered' }));
    expect(s.badge.fail).toHaveBeenCalledWith(1);
  });

  test('badge.fail 复用 "!" 徽标', () => {
    const action = { setBadgeText: jest.fn(), setBadgeBackgroundColor: jest.fn() };
    createActionBadge(action, { setTimeout: () => 0, clearTimeout: () => {} }).fail(3);
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 3, text: '!' });
  });
});

describe('设置页接线', () => {
  test('settings.js 真的调用 bindInstantSave：改模式立即写入', async () => {
    // AR-09：设置页 toast 的 3 秒计时器会拖住 jest 退出；用随真实时间推进的假计时器，测完清掉
    jest.useFakeTimers({ advanceTimers: true });
    const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
    const { window, document } = parseHTML(html);
    const calls = [];
    const storage = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : (...a) => { calls.push([k, ...a]); if (k === 'getLanguage') return Promise.resolve('en'); if (k === 'getStatistics') return Promise.resolve({}); if (k === 'getConversionMode') return Promise.resolve('fast'); return Promise.resolve(undefined); }) });
    jest.doMock('@utils/storage', () => ({ __esModule: true, default: storage }));
    Object.assign(global, { document, window: Object.assign(window, { location: { search: '' } }), confirm: () => false, chrome: { runtime: { getManifest: () => ({ version: '0.0.0' }) } } });
    jest.isolateModules(() => { require('../src/ui/settings/settings.js'); });
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await flush(); await flush();
    const always = document.querySelector('input[name="conversionMode"][value="always"]');
    always.checked = true;
    always.dispatchEvent(new window.Event('change'));
    await flush();
    expect(calls.some((c) => c[0] === 'setConversionMode' && c[1] === 'always')).toBe(true);
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
