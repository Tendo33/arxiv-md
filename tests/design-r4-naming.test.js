const fs = require('fs');
const path = require('path');
import { translations } from '@config/locales';

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('设计建议：统一叫「PDF 解析」，中文全角括号、英文半角括号', () => {
  test('界面文案与 README 不再出现「高质量」/ HQ', () => {
    for (const [k, v] of Object.entries(translations.zh)) if (typeof v === 'string') expect(`${k}=${v}`).not.toMatch(/高质量/);
    for (const [k, v] of Object.entries(translations.en)) if (typeof v === 'string') expect(`${k}=${v}`).not.toMatch(/\(HQ\)|high-quality/i);
    expect(read('src/ui/popup/popup.html')).not.toMatch(/高质量/);
    expect(read('README_CN.md')).not.toMatch(/PDF 高质量解析/);
    expect(read('README.md')).not.toMatch(/\(HQ\)|high-quality/i);
    expect(translations.zh.popup_btn_mineru).toBe('PDF 解析');
    expect(translations.en.popup_btn_mineru).toBe('PDF parsing');
  });
  test('括号：zh 全角、en 半角（后端标签、菜单快捷键、菜单后端）', () => {
    expect(translations.zh.popup_backend).toBe('（{provider}）');
    expect(translations.en.popup_backend).toBe('({provider})');
    expect(translations.zh.menu_with_shortcut).toBe('{label}（{shortcut}）');
    expect(translations.en.menu_with_shortcut).toBe('{label} ({shortcut})');
    for (const v of Object.values(translations.zh)) if (typeof v === 'string' && /\{provider\}/.test(v)) expect(v).not.toMatch(/\(\{provider\}\)/);
    expect(read('src/ui/popup/popup.js')).toMatch(/t\(\)\.popup_backend/);
    expect(read('src/background/context-menu.js')).toMatch(/t\.menu_with_shortcut/);
  });
});
