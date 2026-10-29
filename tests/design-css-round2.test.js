import fs from 'fs';
import path from 'path';

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const rule = (css, sel) => {
  const m = css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return m ? m[2] : '';
};

describe('Round 2 设计验收', () => {
  const settings = read('src/ui/settings/settings.css');
  test('必须改 1：token 输入框用 --surface 底色', () => {
    expect(rule(settings, '.input-field')).toMatch(/background:\s*var\(--surface\)/);
  });
});

describe('Round 2 设计验收建议（S 级）', () => {
  const settings = read('src/ui/settings/settings.css');
  const popup = read('src/ui/popup/popup.css');
  const { translations } = require('../src/config/locales');
  test('设置页：h1 20/600，.btn 8/16 + min-height 36，.btn-icon 1px，toast 用 token 且淡入淡出', () => {
    expect(rule(settings, '.logo h1')).toMatch(/font-size: 20px[^;]*;\s*\/?\*?[^\n]*\n\s*font-weight: 600/);
    expect(rule(settings, '.btn')).toMatch(/padding: 8px 16px/);
    expect(rule(settings, '.btn')).toMatch(/min-height: 36px/);
    expect(rule(settings, '.btn-icon')).toMatch(/border: 1px solid/);
    expect(rule(settings, '.btn-test:hover')).not.toMatch(/rgba\(5, 150, 105/);
    // design-abs-buttons-2026-10-29 B7：浮层 toast 已删除，保存提示在 .autosave-note（见 settings-save-status-b7.test.js）
    expect(rule(settings, '.toast')).toBe('');
  });
  test('popup：删除按钮 600 + 文案 Delete/删除，确认消息 balance，无斜体', () => {
    expect(popup).toMatch(/\.confirm-ok\{font-weight:600\}/);
    expect(popup).toMatch(/\.confirm-message\{text-wrap:balance\}/);
    expect(popup).toMatch(/\.action-placeholder\{font-style:normal\}/);
    expect(translations.en.popup_btn_confirm).toBe('Delete');
    expect(translations.zh.popup_btn_confirm).toBe('删除');
  });
  test('文案：统计标签 sentence case，不用 ASCII 省略号', () => {
    expect(translations.en.stats_mineru).toBe('PDF parsing success');
    expect(translations.en.stats_ar5iv).toBe('HTML success');
    for (const l of ['en', 'zh']) {
      for (const [k, v] of Object.entries(translations[l])) {
        if (typeof v === 'string') expect(`${k}=${v}`).not.toMatch(/\.\.\.$/);
      }
    }
  });
});

test('任务卡占位与标题截断用 … 而非 ASCII ...', () => {
  for (const f of ['src/ui/popup/task-list.js', 'src/background/mineru-task-runner.js']) {
    expect(read(f)).not.toMatch(/['"`]\.\.\.|\}\.\.\.</);
  }
});
