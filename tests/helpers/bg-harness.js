// 加载真实的 background/index.js：chrome.* 全部 mock，收集 onMessage 监听器，能逐个入口发消息。
// mineru-task-runner 的 process / confirmSend 换成 jest.fn，chrome.alarms.create 可断言（keepAlive 行为测试用）。
export function loadBackground({ stats = { pending: 1, processing: 0 } } = {}) {
  const listeners = {};
  const ev = (name) => ({ addListener: (fn) => { (listeners[name] = listeners[name] || []).push(fn); } });
  const create = jest.fn(async () => {});
  global.chrome = {
    runtime: { id: 'me', onMessage: ev('message'), onInstalled: ev('installed'), onStartup: ev('startup'), getURL: (p) => `chrome-extension://me/${p}`, sendMessage: () => Promise.resolve(), getManifest: () => ({ version: '0' }), getContexts: async () => [] },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { onUpdated: ev('tu'), onRemoved: ev('tr'), query: async () => [], sendMessage: async () => {} },
    commands: { onCommand: ev('cmd') },
    contextMenus: { create: () => {}, removeAll: (cb) => cb && cb(), onClicked: ev('cm') },
    alarms: { onAlarm: ev('alarm'), create, clear: async () => true, get: async () => null },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, sync: { get: async () => ({}), set: async () => {} }, onChanged: ev('sc') },
    notifications: { onClicked: ev('nc'), create: () => {} },
    permissions: { contains: async () => true, onAdded: ev('pa'), onRemoved: ev('pr') },
  };
  let mod; let tm;
  const proc = jest.fn(async () => ({}));
  const confirm = jest.fn(async () => ({ confirmed: true }));
  jest.isolateModules(() => {
    jest.doMock('../../src/background/mineru-task-runner', () => ({
      ...jest.requireActual('../../src/background/mineru-task-runner'),
      processMinerUTaskInBackground: proc,
      confirmPdfSend: confirm,
    }));
    mod = require('../../src/background/index.js');
    tm = require('../../src/core/task-manager').default;
  });
  jest.spyOn(tm, 'getStatistics').mockResolvedValue(stats);
  const send = (message, sender = { id: 'me', url: 'chrome-extension://me/popup.html' }) => new Promise((resolve) => {
    let async = false;
    for (const fn of listeners.message || []) { const r = fn(message, sender, resolve); if (r === true) async = true; }
    if (!async) setTimeout(() => resolve(undefined), 0);
  });
  const keepAliveCreated = () => create.mock.calls.some(([n]) => n === 'keepAlive');
  return { mod, tm, send, create, proc, confirm, keepAliveCreated };
}
export const flush = () => new Promise((r) => setTimeout(r, 0));
