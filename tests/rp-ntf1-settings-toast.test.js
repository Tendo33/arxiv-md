// release-polish 设计 NTF1：设置页 toast 不能盖住吸底的「恢复默认」
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');

describe('NTF1 设置页 toast 位置', () => {
  test('toast 的 bottom 跟随操作栏高度，不再是固定 32px', () => {
    const toast = css.match(/\n\.toast \{[^}]*\}/)[0];
    expect(toast).toContain('bottom: calc(var(--footer-h, 72px) + 12px);');
    expect(toast).not.toMatch(/bottom: 32px/);
  });
  test('桌面 80px、窄宽（操作栏纵向两行）112px', () => {
    expect(css).toMatch(/:root \{\n {2}--footer-h: 80px;\n\}/);
    const narrow = css.slice(css.indexOf('@media (max-width: 720px)'));
    expect(narrow).toMatch(/--footer-h: 112px;/);
  });
  // design-abs-buttons-2026-10-29 R03：操作栏改回文档流（见 settings-focus-r07.test.js）
  test('操作栏不再吸底', () => {
    expect(css).not.toMatch(/\.actions-bar \{[^}]*position: sticky;/);
  });
});
