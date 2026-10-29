// QA L-02：abs 页按钮的后端名必须和设置页一致（sync 未设置 pdfProvider 时按 pickPdfProvider 规则）
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';

async function inject({ sync = {}, local = {} }) {
  jest.resetModules();
  const { window, document } = parseHTML('<html><head></head><body><div class="submission-history">h</div></body></html>');
  Object.defineProperty(window, 'location', { value: { href: 'https://arxiv.org/abs/1810.04805' }, configurable: true });
  global.window = window; global.document = document;
  global.getComputedStyle = () => ({ backgroundColor: 'rgb(255,255,255)', color: 'rgb(0,0,0)' });
  window.getComputedStyle = global.getComputedStyle;
  window.matchMedia = () => ({ matches: false });
  const pick = (src, keys) => { const ks = Array.isArray(keys) ? keys : [keys]; return Object.fromEntries(ks.filter((k) => k in src).map((k) => [k, src[k]])); };
  global.chrome = { storage: { sync: { get: async (k) => pick(sync, k) }, local: { get: async (k) => pick(local, k) } }, runtime: { sendMessage: jest.fn() } };
  const mod = require('../src/content/page-buttons');
  mod.setPageButtonText(translations.en);
  await mod.injectConvertButton();
  return document.body.textContent;
}
afterAll(() => { delete global.window; delete global.document; delete global.chrome; delete global.getComputedStyle; });

test('pdfProvider 未设置、无 MinerU Key → 显示 PaddleOCR（和设置页默认一致）', async () => {
  const text = await inject({ sync: { conversionMode: 'always' } });
  expect(text).toContain('PaddleOCR');
  expect(text).not.toContain('MinerU');
});
test('pdfProvider 未设置、有 MinerU Key（老用户）→ MinerU', async () => {
  const text = await inject({ sync: { conversionMode: 'always' }, local: { providerKeys: { mineru: 'k' } } });
  expect(text).toContain('MinerU');
});
test('显式选了 paddleocr → PaddleOCR', async () => {
  expect(await inject({ sync: { conversionMode: 'always', pdfProvider: 'paddleocr' } })).toContain('PaddleOCR');
});
