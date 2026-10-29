// release-polish 设计：英文副标题 "by title"；PDF 按钮带完整含义的 title + aria-label（中英）
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';

async function inject(lang) {
  jest.resetModules();
  const { window, document } = parseHTML('<html><head></head><body><div class="submission-history">h</div></body></html>');
  Object.defineProperty(window, 'location', { value: { href: 'https://arxiv.org/abs/1810.04805' }, configurable: true });
  global.window = window; global.document = document;
  global.getComputedStyle = () => ({ backgroundColor: 'rgb(255,255,255)', color: 'rgb(0,0,0)' });
  window.getComputedStyle = global.getComputedStyle;
  window.matchMedia = () => ({ matches: false });
  global.chrome = { storage: { sync: { get: async () => ({}) }, local: { get: async () => ({}) } }, runtime: { sendMessage: jest.fn() } };
  const mod = require('../src/content/page-buttons');
  mod.setPageButtonText(translations[lang]);
  await mod.injectConvertButton();
  return document.querySelector('.arxiv-pdf-download-btn');
}

afterAll(() => { delete global.window; delete global.document; delete global.chrome; delete global.getComputedStyle; });

test('en 副标题是 "by title"，zh 不变', () => {
  expect(translations.en.content_btn_sub_title).toBe('by title');
  expect(translations.zh.content_btn_sub_title).toBe('标题');
});
test.each([
  ['en', 'Download PDF named after the paper title', 'by title'],
  ['zh', '下载以论文标题命名的 PDF', '标题'],
])('%s PDF 按钮 title/aria-label', async (lang, label, sub) => {
  const btn = await inject(lang);
  expect(btn).toBeTruthy();
  expect(btn.getAttribute('aria-label')).toBe(label);
  expect(btn.getAttribute('title')).toBe(label);
  expect(btn.querySelector('.arxiv-md-btn-sub').textContent).toBe(sub);
});
