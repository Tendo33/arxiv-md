// M-1（AB8-05 设计验收）：页面进度卡有真正的 progressbar；总大小未知时不确定态；检查阶段无百分比；live 区只读阶段文字
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';

async function mount(lang = 'zh') {
  jest.resetModules();
  const { window, document } = parseHTML('<html><head></head><body><div class="submission-history">h</div></body></html>');
  Object.defineProperty(window, 'location', { value: { href: 'https://arxiv.org/abs/1810.04805' }, configurable: true });
  global.window = window; global.document = document;
  global.getComputedStyle = () => ({ backgroundColor: 'rgb(255,255,255)', color: 'rgb(0,0,0)' });
  window.getComputedStyle = global.getComputedStyle;
  window.matchMedia = () => ({ matches: false });
  global.chrome = { storage: { sync: { get: async () => ({}) }, local: { get: async () => ({}) } }, runtime: { sendMessage: jest.fn() } };
  const t = translations[lang];
  const pb = require('../src/content/page-buttons');
  pb.setPageButtonText(t);
  await pb.injectConvertButton();
  const ui = require('../src/content/progress-ui');
  ui.setProgressText(t);
  const card = document.querySelector('.arxiv-md-progress');
  return { t, ui, card, bar: card.querySelector('[role="progressbar"]') };
}
// live 区实际会被念的文字：去掉 aria-hidden 子树
const spoken = (el) => {
  const c = el.cloneNode(true);
  c.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return c.textContent.replace(/\s+/g, ' ').trim();
};
afterAll(() => { delete global.window; delete global.document; delete global.chrome; delete global.getComputedStyle; });

test.each(['zh', 'en'])('%s：初始有 progressbar（aria-label 下载进度），不写死 0%%，无 valuenow', async (lang) => {
  const { t, card, bar } = await mount(lang);
  expect(bar).toBeTruthy();
  expect(bar.getAttribute('aria-label')).toBe(lang === 'zh' ? '下载进度' : 'Download progress');
  expect(t.content_progress_bar_label).toBe(bar.getAttribute('aria-label'));
  expect(bar.hasAttribute('aria-valuenow')).toBe(false);
  expect(card.querySelector('.progress-percent').getAttribute('aria-hidden')).toBe('true');
  expect(card.querySelector('.progress-percent').textContent).toBe('');
});

test('有 totalBytes：aria-valuenow 取整、显示百分比、填充宽度', async () => {
  const { ui, card, bar } = await mount();
  ui.updateProgressUI({ stage: 'downloading', progress: 41.6 });
  expect(bar.getAttribute('aria-valuenow')).toBe('42');
  expect(bar.classList.contains('indeterminate')).toBe(false);
  expect(card.querySelector('.progress-percent').textContent).toBe('42%');
  expect(bar.firstElementChild.style.width).toBe('42%');
});

test('没有 totalBytes：不设 aria-valuenow、不显示百分比、不确定态', async () => {
  const { ui, card, bar } = await mount();
  ui.updateProgressUI({ stage: 'downloading', progress: 30 });
  ui.updateProgressUI({ stage: 'downloading', progress: null });
  expect(bar.hasAttribute('aria-valuenow')).toBe(false);
  expect(bar.classList.contains('indeterminate')).toBe(true);
  expect(card.querySelector('.progress-percent').textContent).toBe('');
});

test('检查阶段：即使带 progress 也不显示百分比', async () => {
  const { ui, card, bar } = await mount();
  ui.updateProgressUI({ stage: 'checking', progress: 0 });
  expect(card.querySelector('.progress-percent').textContent).toBe('');
  expect(bar.hasAttribute('aria-valuenow')).toBe(false);
});

test('live 区只有阶段文字；同阶段刷新进度不改动阶段文字节点', async () => {
  const { t, ui, card } = await mount();
  expect(card.getAttribute('aria-live')).toBe('polite');
  ui.updateProgressUI({ stage: 'downloading', progress: 10 });
  expect(spoken(card)).toBe(t.content_progress_downloading);
  const textNode = card.querySelector('.progress-text').firstChild;
  ui.updateProgressUI({ stage: 'downloading', progress: 70 });
  expect(card.querySelector('.progress-text').firstChild).toBe(textNode);
  expect(spoken(card)).not.toMatch(/\d+%/);
  ui.updateProgressUI({ stage: 'checking', progress: null });
  expect(spoken(card)).toBe(t.content_progress_checking);
});

test('完成/失败时进度条隐藏', async () => {
  const { ui, bar } = await mount();
  ui.setProgressState({ text: 'x', state: 'error' });
  expect(bar.hidden).toBe(true);
});

test('样式：4px/2px、亮暗色、不确定 30% 1.2s、reduced-motion 静止 30%、tabular-nums', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/content/page-button-styles.js'), 'utf8');
  expect(css).toMatch(/\.progress-percent\s*{[^}]*tabular-nums/);
  expect(css).toMatch(/\.progress-bar\s*{[^}]*height:\s*4px[^}]*border-radius:\s*2px[^}]*#d0d4dc/);
  expect(css).toMatch(/\.progress-fill\s*{[^}]*#b31b1b/);
  // 卡片是 column + align-items:flex-start，进度条必须自己撑满，否则宽度为 0
  expect(css).toMatch(/\.progress-bar\s*{[^}]*align-self:\s*stretch/);
  expect(css).toMatch(/data-theme="dark"\]\s*\.progress-bar\s*{[^}]*#3a3f47/);
  expect(css).toMatch(/data-theme="dark"\]\s*\.progress-fill\s*{[^}]*#f87171/);
  expect(css).toMatch(/\.indeterminate \.progress-fill\s*{[^}]*width:\s*30%[^}]*1\.2s[^}]*infinite/);
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*{\s*\.progress-bar\.indeterminate \.progress-fill\s*{[^}]*animation:\s*none[^}]*width:\s*30%/);
});
