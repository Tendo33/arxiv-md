/**
 * design-abs-buttons-2026-10-29 B7（§2.6）：保存提示放进操作栏 .autosave-note（role=status），
 * 删除浮层 #toast；失败常驻 + 单独 role=alert 播报；成功 2 秒后恢复默认文案。
 */
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createSaveStatus } from '../src/ui/settings/save-status';
import { translations } from '../src/config/locales';

const root = path.join(__dirname, '../src/ui/settings');
const html = fs.readFileSync(path.join(root, 'settings.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'settings.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'settings.js'), 'utf8');

const setup = (lang = 'zh') => {
  const { document } = parseHTML(html);
  let fire = null;
  const show = createSaveStatus({ doc: document, t: () => translations[lang], setTimer: (fn) => { fire = fn; return 1; }, clearTimer: () => {} });
  return { document, show, fire: () => fire && fire() };
};

test('页面里没有 #toast，CSS 没有 .toast / --footer-h', () => {
  expect(html).not.toMatch(/id="toast"/);
  expect(css).not.toMatch(/\.toast\b|--footer-h/);
  expect(js).not.toMatch(/showToast/);
});

test('.autosave-note 是 role=status polite，旁边有 role=alert 节点', () => {
  const { document } = setup();
  const n = document.getElementById('saveStatus');
  expect(n.className).toBe('autosave-note');
  expect(n.getAttribute('role')).toBe('status');
  expect(n.getAttribute('aria-live')).toBe('polite');
  expect(document.getElementById('saveAlert').getAttribute('role')).toBe('alert');
});

test('成功：✓ 图标 + 「已保存」，2 秒后恢复「更改会自动保存」', () => {
  const { document, show, fire } = setup('zh');
  show(translations.zh.toast_saved, 'success');
  const n = document.getElementById('saveStatus');
  expect(n.classList.contains('saved')).toBe(true);
  expect(n.querySelector('svg')).not.toBeNull();
  expect(n.textContent.trim()).toBe('已保存');
  fire();
  expect(n.className).toBe('autosave-note');
  expect(n.textContent).toBe(translations.zh.autosave_note);
  expect(n.querySelector('[data-i18n=autosave_note]')).not.toBeNull();
});

test('失败：.error 常驻，role=alert 节点播报，不自动恢复', () => {
  const { document, show, fire } = setup('en');
  show(`${translations.en.toast_save_failed} quota`, 'error');
  const n = document.getElementById('saveStatus');
  expect(n.classList.contains('error')).toBe(true);
  expect(n.textContent).toBe('Could not save: quota');
  expect(document.getElementById('saveAlert').textContent).toBe('Could not save: quota');
  fire();
  expect(n.classList.contains('error')).toBe(true);
});

test('恢复默认 / 重置统计的成功文案短、不带 emoji', () => {
  for (const L of ['zh', 'en']) for (const k of ['toast_saved', 'toast_reset', 'toast_stats_reset']) expect(translations[L][k]).not.toMatch(/[✅❌]/u);
  expect([translations.zh.toast_reset, translations.zh.toast_stats_reset]).toEqual(['已恢复默认', '已重置']);
});

test('操作栏单行左右分组，按钮不拉满', () => {
  expect(css).toMatch(/\.actions-bar \{ flex-direction: row; align-items: center; justify-content: space-between;/);
  expect(css).toMatch(/\.actions-bar \.btn \{ width: auto; \}/);
});
