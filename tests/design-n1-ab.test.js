// 设计增量验收 建议 A：没有 Key 时用 info 提示框 + 「打开设置」，不用红色错误框
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';

jest.mock('@utils/storage', () => ({ __esModule: true, default: {
  getLanguage: async () => 'en',
  getActivePdfProvider: async () => ({ id: 'mineru', hasKey: false, keyMissingHere: false }),
} }));
jest.mock('@utils/logger', () => ({ __esModule: true, default: { warn() {}, error() {}, info() {}, debug() {}, log() {} } }));

const html = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

async function loadPopup() {
  const { window, document } = parseHTML(html);
  global.window = window; global.document = document;
  window.close = () => {};
  Object.defineProperty(global, 'navigator', { value: { userAgent: 'Chrome/156', language: 'en-US' }, configurable: true });
  const openOptionsPage = jest.fn();
  global.chrome = {
    commands: { getAll: async () => [] },
    tabs: { query: async () => [{ id: 1, url: 'https://arxiv.org/abs/2401.00001', status: 'complete' }], sendMessage: async () => ({ success: true, ready: true }), create: async () => {}, reload: async () => {} },
    runtime: { sendMessage: async () => ({ success: true, tasks: [] }), getManifest: () => ({ version: '0.0.0' }), openOptionsPage },
    storage: { onChanged: { addListener() {} }, local: { get: async () => ({}) }, sync: { get: async () => ({}) } },
  };
  jest.isolateModules(() => { require('../src/ui/popup/popup.js'); });
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await flush();
  return { document, window, openOptionsPage };
}

describe('建议 A：缺 Key 提示', () => {
  test('点击 PDF 解析：显示 info 框（#alertKey.alert.info），红框隐藏，按钮打开设置', async () => {
    const { document, window, openOptionsPage } = await loadPopup();
    const mineru = document.getElementById('mineruBtn');
    mineru.disabled = false;
    mineru.dispatchEvent(new window.Event('click'));
    await flush();
    const box = document.getElementById('alertKey');
    expect(box.classList.contains('hidden')).toBe(false);
    expect(box.classList.contains('info')).toBe(true);
    expect(box.classList.contains('err')).toBe(false);
    expect(document.getElementById('alertErr').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('keyHereTitle').textContent).toBe('MinerU key is not set');
    const btn = document.getElementById('keySettingsBtn');
    expect(btn).not.toBeNull();
    expect(btn.textContent.trim()).toBe('Open settings');
    btn.dispatchEvent(new window.Event('click'));
    expect(openOptionsPage).toHaveBeenCalledTimes(1);
  });
});

test('C/C2：有待确认行时 #taskList 最小高度至少 72px（放下一整行折行后的待确认任务）', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
  const m = css.match(/#taskList:has\(\.row\[data-status=awaiting_consent\]\)\{min-height:(\d+)px/);
  expect(m).not.toBeNull();
  expect(Number(m[1])).toBeGreaterThanOrEqual(72);
});
