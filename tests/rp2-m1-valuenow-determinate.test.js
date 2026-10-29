// rp2 M-1：aria-valuenow 只在「下载阶段 + 已知总大小（bytesKnown）」时写；估算百分比一律不确定态
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';

async function mount() {
  jest.resetModules();
  const { window, document } = parseHTML('<html><head></head><body><div class="submission-history">h</div></body></html>');
  Object.defineProperty(window, 'location', { value: { href: 'https://arxiv.org/abs/1810.04805' }, configurable: true });
  global.window = window; global.document = document;
  global.getComputedStyle = () => ({ backgroundColor: 'rgb(255,255,255)', color: 'rgb(0,0,0)' });
  window.getComputedStyle = global.getComputedStyle;
  window.matchMedia = () => ({ matches: false });
  global.chrome = { storage: { sync: { get: async () => ({}) }, local: { get: async () => ({}) } }, runtime: { sendMessage: jest.fn() } };
  const t = translations.zh;
  const pb = require('../src/content/page-buttons');
  pb.setPageButtonText(t);
  await pb.injectConvertButton();
  const ui = require('../src/content/progress-ui');
  ui.setProgressText(t);
  const card = document.querySelector('.arxiv-md-progress');
  return { ui, card, bar: card.querySelector('[role="progressbar"]') };
}
afterAll(() => { delete global.window; delete global.document; delete global.chrome; delete global.getComputedStyle; });

const estimated = [
  ['submitting', { stage: 'submitting', progress: 0 }],
  ['processing（MinerU 估算 10+0.8x）', { stage: 'processing', progress: 50 }],
  ['downloading（MinerU 固定 90，无 bytesKnown）', { stage: 'downloading', progress: 90 }],
  ['extracting', { stage: 'extracting', progress: 95 }],
  ['downloading bytesKnown:false', { stage: 'downloading', progress: 40, bytesKnown: false }],
  ['processing 误带 bytesKnown', { stage: 'processing', progress: 40, bytesKnown: true }],
];

test.each(estimated)('估算阶段 %s：不写 aria-valuenow、不显示百分比、不确定态', async (_n, p) => {
  const { ui, card, bar } = await mount();
  ui.updateProgressUI({ stage: 'downloading', progress: 20, bytesKnown: true });
  expect(bar.getAttribute('aria-valuenow')).toBe('20');
  ui.updateProgressUI(p);
  expect(bar.hasAttribute('aria-valuenow')).toBe(false);
  expect(bar.classList.contains('indeterminate')).toBe(true);
  expect(card.querySelector('.progress-percent').textContent).toBe('');
  expect(bar.firstElementChild.style.width).toBe('');
  expect(bar.getAttribute('aria-valuemin')).toBe('0');
  expect(bar.getAttribute('aria-valuemax')).toBe('100');
});

test('下载阶段 + bytesKnown：写 aria-valuenow 并显示百分比', async () => {
  const { ui, card, bar } = await mount();
  ui.updateProgressUI({ tier: 'pdf', stage: 'downloading', progress: 63.4, bytesKnown: true });
  expect(bar.getAttribute('aria-valuenow')).toBe('63');
  expect(card.querySelector('.progress-percent').textContent).toBe('63%');
  expect(bar.classList.contains('indeterminate')).toBe(false);
});

test('isDeterminate 只认下载阶段 + bytesKnown + 数字', () => {
  const { isDeterminate } = require('../src/content/progress-ui');
  expect(isDeterminate({ stage: 'downloading', progress: 1, bytesKnown: true })).toBe(true);
  expect(isDeterminate({ stage: 'downloading', progress: null, bytesKnown: true })).toBe(false);
  expect(isDeterminate({ stage: 'downloading', progress: 90 })).toBe(false);
  expect(isDeterminate({ stage: 'processing', progress: 50, bytesKnown: true })).toBe(false);
});

test('converter：只有 downloadFile 的字节进度带 bytesKnown（null 时为 false）', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/core/converter/index.js'), 'utf8');
  expect(src).toMatch(/stage: 'downloading', progress, bytesKnown: typeof progress === 'number'/);
  expect(src).toMatch(/stage: 'downloading', progress: p, bytesKnown: typeof p === 'number'/);
  const mineru = fs.readFileSync(path.join(__dirname, '../src/core/converter/mineru-client.js'), 'utf8');
  expect(mineru).not.toMatch(/bytesKnown/);
});
