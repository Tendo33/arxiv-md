const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
const pkg = require('../package.json');

describe('设计 M1：popup 所有状态固定 360px', () => {
  test('html/body 无条件 360，body 最小宽也是 360', () => {
    expect(css).toMatch(/^html,body\{width:360px\}/m);
    expect(css).toMatch(/body\{min-width:360px\}/);
  });
  test('没有任何 media query 把 html/body 或 .pop 改成 100%', () => {
    expect(css).not.toMatch(/html,body\{width:100%\}/);
    expect(css).not.toMatch(/--pw:100%/);
  });
  test('e2e-popup-width 在 test:e2e 链里', () => {
    expect(pkg.scripts['test:e2e']).toMatch(/node scripts\/e2e-popup-width\.js/);
    expect(fs.existsSync(path.join(__dirname, '../scripts/e2e-popup-width.js'))).toBe(true);
  });
});
