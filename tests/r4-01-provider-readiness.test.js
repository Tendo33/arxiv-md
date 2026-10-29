/**
 * R4-01：PDF 解析是否可用 = 当前选中的后端在本设备有 Key（storage.getPdfParseReadiness）。
 * 用真实 storage + chrome.storage 桩（不 mock getMinerUToken），覆盖 4 个入口 × 2 个后端 × always/fast。
 * 入口到 converter 的映射：快捷键 / 右键菜单 / 悬浮按钮 → TRIGGER_CONVERSION（markdown，不带 forceMineru）；
 * popup「PDF 解析」→ mode=mineru → paperInfo.forceMineru=true（见 src/content/index.js）。
 */
import { installChrome } from './helpers/chrome-stubs';

const mockAddTask = jest.fn(async (paperInfo, type, provider) => ({ id: 't-1', provider }));
jest.mock('@core/task-manager', () => ({ __esModule: true, default: { findTaskByArxivId: jest.fn(async () => null), addTask: (...a) => mockAddTask(...a) } }));
jest.mock('@background/index.js', () => ({ __esModule: true, processMinerUTaskInBackground: jest.fn() }), { virtual: true });
jest.mock('@core/converter/ar5iv-converter', () => ({ __esModule: true, default: { convert: jest.fn(async () => ({ markdown: '# T\n\nBody text.', title: 'T', metadata: { source: 'arxiv-html' } })) } }));
jest.mock('@utils/helpers', () => ({ __esModule: true, ...jest.requireActual('@utils/helpers'), showNotification: jest.fn() }));
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));

const ENTRIES = { shortcut: {}, contextMenu: {}, fab: {}, popupPdf: { forceMineru: true } };
const PROVIDERS = ['paddleocr', 'mineru'];
const MODES = ['always', 'fast'];

let chrome; let storage; let converter;
beforeEach(() => {
  jest.useFakeTimers();
  mockAddTask.mockClear();
  jest.resetModules();
  chrome = installChrome();
  chrome.runtime.getManifest = () => ({});
  storage = require('../src/utils/storage').default;
  converter = require('../src/core/converter').default;
  converter._downloadViaContentScript = jest.fn(async () => {});
});
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

async function setup(provider, mode, { key = true, ack = true } = {}) {
  await chrome.storage.sync.set({ pdfProvider: provider, conversionMode: mode });
  await chrome.storage.local.set({ providerKeys: key ? { [provider]: `fixture-${provider}` } : {} });
  if (ack) await chrome.storage.local.set({ [`disclosureAck.${provider}`]: 1 }); // 附录 C10：已确认数据说明
}

describe.each(PROVIDERS)('后端 %s（只配这个后端的 Key）', (provider) => {
  describe.each(MODES)('模式 %s', (mode) => {
    test.each(Object.keys(ENTRIES))('入口 %s', async (entry) => {
      await setup(provider, mode);
      const r = await converter.convert({ arxivId: '2401.00001', title: 'T', ...ENTRIES[entry] }, null, 7);
      const expectTask = mode === 'always' || entry === 'popupPdf';
      if (expectTask) {
        expect(mockAddTask).toHaveBeenCalledTimes(1);
        expect(mockAddTask.mock.calls[0][2]).toBe(provider);
        expect(r).toMatchObject({ success: true, background: true, taskId: 't-1' });
      } else {
        expect(mockAddTask).not.toHaveBeenCalled();
        expect(r.background).toBeUndefined();
      }
    });
  });
});

test('选 paddleocr 但只有 MinerU Key → 未配置，不创建任务（不能借用另一个后端的 Key）', async () => {
  await chrome.storage.sync.set({ pdfProvider: 'paddleocr', conversionMode: 'always' });
  await chrome.storage.local.set({ providerKeys: { mineru: 'fixture-mineru' } });
  expect(await storage.getPdfParseReadiness()).toEqual({ ready: false, provider: 'paddleocr' });
  await converter.convert({ arxivId: '2401.00001', title: 'T', forceMineru: true }, null, 7);
  expect(mockAddTask).not.toHaveBeenCalled();
});

test('新用户默认 paddleocr + 只填 paddle Key → ready', async () => {
  await chrome.storage.local.set({ providerKeys: { paddleocr: 'fixture-paddle' } });
  expect(await storage.getPdfParseReadiness()).toEqual({ ready: true, provider: 'paddleocr' });
});

test('源码里不再有只看 MinerU token 的判断（converter / context-menu）', () => {
  const fs = require('fs'); const path = require('path');
  for (const f of ['src/core/converter/index.js', 'src/background/context-menu.js']) {
    expect([f, /getMinerUToken/.test(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))]).toEqual([f, false]);
  }
  const content = fs.readFileSync(path.join(__dirname, '../src/content/index.js'), 'utf8');
  expect(content).toMatch(/if \(type === 'mineru'\) metadata\.forceMineru = true/);
});

describe('附录 C10：没确认数据说明 → 四个入口都不建任务、不发请求，打开设置页 #disclose=<provider>', () => {
  test.each(PROVIDERS)('%s', async (provider) => {
    chrome.tabs = { ...(chrome.tabs || {}), create: jest.fn() };
    chrome.runtime.getURL = (p) => `chrome-extension://x/${p}`;
    for (const entry of Object.keys(ENTRIES)) {
      mockAddTask.mockClear(); chrome.tabs.create.mockClear();
      await chrome.storage.local.clear();
      await setup(provider, 'always', { ack: false });
      const r = await converter.convert({ arxivId: '2401.00001', title: 'T', ...ENTRIES[entry] }, null, 7);
      expect([entry, mockAddTask.mock.calls.length]).toEqual([entry, 0]);
      expect(r).toMatchObject({ success: false, disclosureNeeded: true, provider });
      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: `chrome-extension://x/settings.html#disclose=${provider}` });
    }
  });
  test('状态卡文案：两家共用「需要先确认数据说明」（C11）', () => {
    const { statusCardErrorText } = require('../src/content/status-error');
    const { translations } = require('../src/config/locales');
    const zh = translations.zh;
    expect(statusCardErrorText({ success: false, disclosureNeeded: true, provider: 'paddleocr' }, zh)).toBe('需要先确认数据说明。已打开设置页，确认后回到这里再点一次。');
    expect(statusCardErrorText({ data: { success: false, disclosureNeeded: true, provider: 'mineru' } }, zh)).not.toMatch(/上传/);
    expect(statusCardErrorText({ success: false, disclosureNeeded: true, provider: 'mineru' }, translations.en)).toBe("Review what's shared first. Settings is open. Confirm there, then click again here.");
  });
});
