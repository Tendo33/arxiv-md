// Round 3 复审：徽标接线——回退（ar5iv → PDF 回退）后仍失败要显示「!」；worker 重启清残留徽标
jest.mock('@core/converter', () => ({ __esModule: true, default: { convert: jest.fn() } }));
import converter from '@core/converter';

const mkAction = () => {
  const state = {};
  return {
    state,
    setBadgeText: jest.fn(({ tabId, text }) => { state[tabId] = { ...state[tabId], text }; return Promise.resolve(); }),
    setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
  };
};

let listeners; let action;
const boot = (tabs) => {
  listeners = {}; action = mkAction();
  for (const t of tabs) action.state[t.id] = { text: t.badge };
  // 同名事件可能有多个监听（C-3 右键菜单也监听 onStartup / onInstalled），全部依次调用
  const all = {};
  const ev = (name) => ({ addListener: (fn) => { (all[name] = all[name] || []).push(fn); listeners[name] = (...a) => Promise.all(all[name].map((f) => f(...a))).then((r) => r[0]); } });
  global.chrome = {
    runtime: { id: 'me', onMessage: ev('message'), onInstalled: ev('installed'), onStartup: ev('startup'), getURL: (p) => p, sendMessage: () => Promise.resolve() },
    action,
    tabs: { onUpdated: ev('tabUpdated'), query: jest.fn(async (q, cb) => { if (cb) cb(tabs); return tabs; }), sendMessage: jest.fn(async () => ({})), onRemoved: ev('tabRemoved') },
    commands: { onCommand: ev('command'), getAll: async () => [] },
    alarms: { onAlarm: ev('alarm'), create: () => {}, clear: async () => true, get: async () => null },
    storage: { local: { get: async () => ({}), set: async () => {} }, sync: { get: async () => ({}), set: async () => {} }, onChanged: ev('storage') },
    downloads: { download: async () => 1 },
    notifications: { onClicked: ev('notif'), create: () => {} },
    contextMenus: { create: () => {}, removeAll: (cb) => cb && cb(), onClicked: ev('menu') },
  };
  jest.isolateModules(() => { require('../src/background/index.js'); });
};
const flush = () => new Promise((r) => setTimeout(r, 10));

test('worker 启动时清掉所有标签页残留的徽标；onStartup 也清', async () => {
  boot([{ id: 1, badge: '…' }, { id: 2, badge: '✓' }]);
  await flush();
  expect(action.state[1].text).toBe('');
  expect(action.state[2].text).toBe('');
  action.state[3] = { text: '!' };
  chrome.tabs.query.mockImplementation(async () => [{ id: 3 }]);
  await listeners.startup();
  expect(action.state[3].text).toBe('');
});

test('快捷键 → CONVERT_PAPER → 转换（含 PDF 回退）最终失败 → 徽标「!」，回复 success:false', async () => {
  boot([]);
  await flush();
  chrome.tabs.query = (_q, cb) => { const t = [{ id: 21, url: 'https://arxiv.org/abs/2301.00001' }]; if (cb) cb(t); return Promise.resolve(t); };
  chrome.tabs.sendMessage = jest.fn((_id, _m, cb) => { cb && cb({ ok: true }); return Promise.resolve(); });
  await listeners.command('convert-current-paper');
  await flush();
  expect(action.state[21].text).toBe('…');
  converter.convert.mockRejectedValueOnce(new Error('ar5iv unavailable; PDF fallback failed: Failed to fetch'));
  const sendResponse = jest.fn();
  listeners.message({ type: 'CONVERT_PAPER', data: { arxivId: '2301.00001' } }, { id: 'me', tab: { id: 21, url: 'https://arxiv.org/abs/2301.00001' } }, sendResponse);
  await flush();
  expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  expect(action.state[21].text).toBe('!');
});

test('快捷键 → 转换成功 → 徽标「✓」', async () => {
  boot([]);
  await flush();
  chrome.tabs.query = (_q, cb) => { const t = [{ id: 22, url: 'https://arxiv.org/abs/2301.00002' }]; if (cb) cb(t); return Promise.resolve(t); };
  chrome.tabs.sendMessage = jest.fn((_id, _m, cb) => { cb && cb({ ok: true }); return Promise.resolve(); });
  await listeners.command('convert-current-paper');
  await flush();
  converter.convert.mockResolvedValueOnce({ filename: 'a.md' });
  listeners.message({ type: 'CONVERT_PAPER', data: { arxivId: '2301.00002' } }, { id: 'me', tab: { id: 22, url: 'https://arxiv.org/abs/2301.00002' } }, jest.fn());
  await flush();
  expect(action.state[22].text).toBe('✓');
});
