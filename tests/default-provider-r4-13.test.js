import { installChrome } from './helpers/chrome-stubs';

describe('R4-13 默认后端规则', () => {
  let chrome; let storage;
  beforeEach(() => { jest.resetModules(); chrome = installChrome(); storage = require('../src/utils/storage').default; });
  const known = (id) => ['paddleocr', 'mineru'].includes(id);

  test('① 已存在 pdfProvider → 用它（即便有 MinerU token）', async () => {
    await chrome.storage.sync.set({ pdfProvider: 'paddleocr' });
    await chrome.storage.local.set({ providerKeys: { mineru: 'fixture-token' } });
    expect(await storage.getPdfProvider(known)).toBe('paddleocr');
  });
  test('② 老用户有 MinerU token → mineru', async () => {
    await chrome.storage.local.set({ providerKeys: { mineru: 'fixture-token' } });
    expect(await storage.getPdfProvider(known)).toBe('mineru');
  });
  test('③ 新用户 → paddleocr，且不带 Key', async () => {
    expect(await storage.getPdfProvider(known)).toBe('paddleocr');
    expect(await storage.getProviderKey('paddleocr')).toBeNull();
  });
  test('未知的 pdfProvider 值按未设置处理；CONVERSION_MODE 默认仍为 FAST', async () => {
    await chrome.storage.sync.set({ pdfProvider: 'nope' });
    expect(await storage.getPdfProvider(known)).toBe('paddleocr');
    const { DEFAULTS } = require('@config/constants');
    expect(DEFAULTS.CONVERSION_MODE).toBe('fast');
  });
  test('setPdfProvider 写 sync', async () => {
    await storage.setPdfProvider('mineru');
    expect(chrome.storage.sync.dump()).toMatchObject({ pdfProvider: 'mineru' });
  });
});
