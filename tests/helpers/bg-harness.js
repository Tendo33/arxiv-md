// 加载真实的 background/index.js：chrome.* 全部 mock，收集 onMessage 监听器，能逐个入口发消息。
// mineru-task-runner 的 process 换成 jest.fn，chrome.alarms.create 可断言（keepAlive 行为测试用）。
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
  };
  let mod; let tm; let converter;
  const proc = jest.fn(async () => ({}));
  jest.isolateModules(() => {
    jest.doMock('../../src/background/mineru-task-runner', () => ({
      ...jest.requireActual('../../src/background/mineru-task-runner'),
      processMinerUTaskInBackground: proc,
    }));
    mod = require('../../src/background/index.js');
    tm = require('../../src/core/task-manager').default;
    // converter 里 `await import('@background/index.js')`：jest 没有这个别名，指到同一个已加载的 background 实例
    jest.doMock('@background/index.js', () => mod, { virtual: true });
    converter = require('../../src/core/converter/index.js').default;
  });
  jest.spyOn(tm, 'getStatistics').mockResolvedValue(stats);
  const send = (message, sender = { id: 'me', url: 'chrome-extension://me/popup.html' }) => new Promise((resolve) => {
    let async = false;
    for (const fn of listeners.message || []) { const r = fn(message, sender, resolve); if (r === true) async = true; }
    if (!async) setTimeout(() => resolve(undefined), 0);
  });
  // 模块加载时自己会续任务并同步一次 alarm；等它跑完再清零，之后的 create 只来自被测入口
  const ready = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); create.mockClear(); proc.mockClear(); };
  const keepAliveCreated = () => create.mock.calls.some(([n]) => n === 'keepAlive');
  return { mod, tm, converter, ready, send, create, proc, keepAliveCreated };
}
export const flush = () => new Promise((r) => setTimeout(r, 0));
