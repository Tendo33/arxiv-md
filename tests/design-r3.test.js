// 设计验收 Round 3：popup 只滚任务列表、MinerU 任务文案、刷新按钮、短时间格式、PDF 悬浮按钮固定浅色+白环
import fs from 'fs';
import path from 'path';
import { formatTimeAgo } from '../src/utils/time-ago';
import { translations } from '../src/config/locales';

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('B1：.body 不滚动，.recent 可收缩，#taskList 自己滚', () => {
  const css = read('src/ui/popup/popup.css');
  expect(css).toMatch(/\.body\{display:flex;flex-direction:column;overflow:hidden\}/);
  expect(css).toMatch(/\.recent\{[^}]*flex:1 1 auto;min-height:0/);
  expect(css).toMatch(/#taskList\{[^}]*overflow-y:auto/);
  expect(css).toMatch(/\.row small\{[^}]*font-size:var\(--fs-xs\)/);
});

test('文案：MinerU 任务 / 空状态', () => {
  expect(translations.zh.popup_recent).toBe('MinerU 任务');
  expect(translations.en.popup_recent).toBe('MinerU tasks');
  expect(translations.zh.popup_recent_empty).toBe('用 MinerU 高质量导出后，任务进度会显示在这里');
  expect(translations.en.popup_recent_empty).toBe('MinerU exports will appear here');
  expect(read('src/ui/popup/popup.html')).toContain('id="recentEmpty"');
});

test('无法连接页面：有刷新按钮并调用 tabs.reload', () => {
  expect(read('src/ui/popup/popup.html')).toMatch(/id="refreshBtn"[^>]*data-i18n="popup_btn_refresh"/);
  const js = read('src/ui/popup/popup.js');
  expect(js).toContain('chrome.tabs.reload(tabId)');
  expect(js).toContain('showRefresh(!!res?.unreachable)');
});

test('行内时间短格式', () => {
  const now = 1_700_000_000_000;
  expect(formatTimeAgo(now - 11 * 60000, 'en', 'now', now, 'narrow')).toBe(new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' }).format(-11, 'minute'));
  expect(formatTimeAgo(now - 11 * 60000, 'en', 'now', now)).toBe('11 minutes ago');
  expect(read('src/ui/popup/task-list.js')).toContain("'narrow')");
});

test('PDF 悬浮按钮：不跟随深色、2px 白环、蓝色焦点环、统一字体栈', () => {
  const src = read('src/content/pdf-fab.js');
  expect(src).not.toMatch(/prefers-color-scheme/);
  expect(src).toContain('--brand:#b31b1b');
  expect(src).toContain('box-shadow:0 0 0 2px #fff,0 4px 12px rgb(0 0 0/.45)');
  expect(src).toContain('.fab:focus-visible{outline:3px solid #8ab4f8;outline-offset:3px}');
  expect(src).toContain('font:700 14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans",sans-serif');
});

test('英文句首大写', () => {
  for (const k of ['mode_title', 'advanced_title', 'btn_reset', 'popup_btn_settings', 'popup_btn_clear_completed']) {
    const words = translations.en[k].split(' ').slice(1);
    expect(words.filter((w) => /^[A-Z][a-z]/.test(w) && !['MinerU', 'Markdown', 'PDF', 'HTML'].includes(w))).toEqual([]);
  }
});
