// 设计 18:16 #2 / 主管 18:17：「重新初始化」改 ghost 按钮
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
test('reinitBtn is a <button> with btn-ghost', () => {
  expect(html).toMatch(/<button type="button" id="reinitBtn" class="btn btn-ghost"/);
});
test('ghost styles: transparent, no border, text-secondary, 36px, light hover/focus', () => {
  expect(css).toMatch(/\.btn-ghost \{ background: transparent; color: var\(--text-secondary\); border: none;/);
  expect(css).toMatch(/\.btn-ghost:hover, \.btn-ghost:focus-visible \{ background: var\(--surface-2\)/);
  expect(css).toMatch(/\.permission-row \.btn-ghost \{[^}]*height: 36px/);
  expect(css).toMatch(/\.btn:focus-visible \{\s*outline: 2px solid var\(--focus-ring\)/);
});
