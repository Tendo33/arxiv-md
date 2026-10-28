// batch5：popup 接线测试（review-fix3 P3）。加载真实 popup.js，stub chrome.commands.getAll，
// 断言 init() → loadShortcut() → renderShortcutGuide 真的把引导渲染出来；删掉 loadShortcut() 调用时这里会失败。
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';

jest.mock('@utils/storage', () => ({ __esModule: true, default: { getLanguage: async () => 'zh' } }));
jest.mock('@utils/logger', () => ({ __esModule: true, default: { warn() {}, error() {}, info() {}, debug() {}, log() {} } }));

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
const html = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };

async function loadPopup(getAll) {
  const { window, document } = parseHTML(html);
  const created = [];
  global.window = window; global.document = document;
  Object.defineProperty(global, 'navigator', { value: { userAgent: CHROME_UA, language: 'zh-CN' }, configurable: true });
  global.chrome = {
    commands: { getAll },
    tabs: { query: async () => [{ id: 1, url: 'https://arxiv.org/abs/2401.00001' }], create: async (o) => { created.push(o.url); }, reload: async () => {} },
    runtime: { sendMessage: async () => ({ success: true, tasks: [] }), getManifest: () => ({ version: '0.0.0' }), openOptionsPage() {} },
    storage: { onChanged: { addListener() {} }, local: { get: async () => ({}) }, sync: { get: async () => ({}) } },
  };
  jest.isolateModules(() => { require('../src/ui/popup/popup.js'); });
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await flush();
  return { document, created };
}

describe('popup.js 快捷键接线', () => {
  test('getAll 返回空 shortcut：出现 #shortcutSetup，点击打开 chrome://extensions/shortcuts', async () => {
    const getAll = jest.fn(async () => [{ name: 'convert-current-paper', shortcut: '' }]);
    const { document, created } = await loadPopup(getAll);
    expect(getAll).toHaveBeenCalled(); // 断言 init 调用了 loadShortcut()
    const btn = document.getElementById('shortcutSetup');
    expect(btn).not.toBeNull(); // 断言 renderShortcutGuide 的结果真的进了 DOM
    btn.dispatchEvent(new document.defaultView.Event('click'));
    await flush();
    expect(created).toEqual(['chrome://extensions/shortcuts']); // 断言 openTab 接到 chrome.tabs.create
  });
  test('getAll 返回空数组（命令缺失）也显示引导', async () => {
    const { document } = await loadPopup(async () => []);
    expect(document.getElementById('shortcutSetup')).not.toBeNull();
  });
  test('已有快捷键：显示 kbd，不出现引导按钮', async () => {
    const { document } = await loadPopup(async () => [{ name: 'convert-current-paper', shortcut: 'Alt+Shift+M' }]);
    expect(document.getElementById('shortcutKbd').textContent).toBe('Alt+Shift+M');
    expect(document.getElementById('shortcutSetup')).toBeNull();
  });
});
