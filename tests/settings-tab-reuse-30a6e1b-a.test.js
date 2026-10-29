// 设计验收 30a6e1b 建议 a：设置页已开着 → 复用该标签页（换 hash），不新开；无新权限、manifest 不变
import fs from 'fs';
import path from 'path';

const area = { get: async () => ({}), set: async () => {}, remove: async () => {} };
const base = () => ({ storage: { sync: area, local: area, onChanged: { addListener() {} } }, runtime: { getURL: (p) => p, onMessage: { addListener() {} } } });
global.chrome = base();
const { openOrReuseSettingsTab } = require('../src/core/converter/index');

const URL0 = 'chrome-extension://abc/settings.html';
function stub(contexts) {
  global.chrome = {
    ...base(),
    runtime: { getURL: (p) => `chrome-extension://abc/${p}`, getContexts: jest.fn(async () => contexts) },
    tabs: { create: jest.fn(async () => ({})), update: jest.fn(async () => ({})) },
    windows: { update: jest.fn(async () => ({})) },
  };
}
afterEach(() => { global.chrome = base(); });

test('reuses an open settings tab: update url+active, focus window, no new tab', async () => {
  stub([{ contextType: 'TAB', tabId: 7, windowId: 3, documentUrl: `${URL0}#x` }]);
  const r = await openOrReuseSettingsTab(`${URL0}#disclose=mineru`);
  expect(r).toEqual({ reused: true, tabId: 7 });
  expect(chrome.tabs.update).toHaveBeenCalledWith(7, { url: `${URL0}#disclose=mineru`, active: true });
  expect(chrome.windows.update).toHaveBeenCalledWith(3, { focused: true });
  expect(chrome.tabs.create).not.toHaveBeenCalled();
  expect(chrome.runtime.getContexts).toHaveBeenCalledWith({ contextTypes: ['TAB'], documentUrls: [URL0] });
});

test('no open settings tab → new tab', async () => {
  stub([]);
  const r = await openOrReuseSettingsTab(`${URL0}#disclose=paddleocr`);
  expect(r.reused).toBe(false);
  expect(chrome.tabs.create).toHaveBeenCalledWith({ url: `${URL0}#disclose=paddleocr` });
});

test('manifest permissions unchanged (no tabs permission added)', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.json'), 'utf8'));
  expect(m.permissions).toEqual(['storage', 'downloads', 'activeTab', 'notifications', 'alarms', 'contextMenus']);
  expect(Number(m.minimum_chrome_version)).toBeGreaterThanOrEqual(116);
});
