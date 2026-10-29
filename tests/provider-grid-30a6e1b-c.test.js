// 设计验收 30a6e1b 建议 c：provider-group 两列；<540 单列
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
test('two equal columns, single column below 540px, cards not height-forced', () => {
  expect(css).toMatch(/\.provider-group \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  expect(css).not.toMatch(/\.provider-group \{[^}]*auto-fit/);
  expect(css).toMatch(/@media \(max-width: 539px\) \{ \.provider-group \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
});
