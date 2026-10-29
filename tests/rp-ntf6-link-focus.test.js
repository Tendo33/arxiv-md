// release-polish 设计 NTF6：设置页链接焦点环 2px 品牌色，.form-hint/页脚链接可点区域加高
import fs from 'fs';
import path from 'path';
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8').replace(/\s+/g, ' ');

test('a:focus-visible 用 2px accent 实线，偏移 2px', () => {
  expect(css).toMatch(/(\} |\*\/ )a:focus-visible \{ outline: 2px solid var\(--accent\); outline-offset: 2px; \}/);
});
test('.form-hint a 和页脚链接 inline-block + 上下 4px', () => {
  expect(css).toMatch(/\.form-hint a, \.footer-links a \{ display: inline-block; padding: 4px 0; \}/);
});
