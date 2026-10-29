// 设计验收 30a6e1b #7：.pd-ok（btn-primary）focus-visible 不叠红影，保留蓝色 outline
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
test('btn-primary focus-visible has no box-shadow; .btn focus outline stays', () => {
  expect(css).toMatch(/\.btn-primary:focus-visible \{ box-shadow: none; \}/);
  // 必须在 .btn-primary 阴影规则之后
  expect(css.lastIndexOf('.btn-primary:focus-visible')).toBeGreaterThan(css.indexOf('.btn-primary:hover'));
  expect(css).toMatch(/\.btn:focus-visible \{\s*outline: 2px solid var\(--focus-ring\);/);
});
