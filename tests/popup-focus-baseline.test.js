// 基线矩阵（R07/R12/R16）：popup 的焦点环用蓝色 --focus（不是品牌红），按钮文字不被裁下伸部分，间距是 2 的倍数
const fs = require('fs');
const path = require('path');
const v2 = fs.readFileSync(path.join(__dirname, '../src/ui/shared/ui-v2.css'), 'utf8');
const pop = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');

describe('popup baseline', () => {
  test('--focus 浅色 #2563eb，深色（data-theme 与系统深色）#60a5fa，不再引用 --brand', () => {
    expect(v2).toMatch(/--focus:#2563eb;/);
    expect(v2).not.toMatch(/--focus:var\(--brand\)/);
    expect((v2.match(/--focus:#60a5fa;/g) || []).length).toBe(2);
  });
  test('.sc-link 焦点用 --focus', () => {
    expect(pop).toMatch(/\.sc-link:focus-visible\{outline:2px solid var\(--focus\)/);
  });
  test('.acts 按钮里的 span 行高 1.3，不裁下伸部分', () => {
    expect(pop).toMatch(/\.acts \.btn>span\{line-height:1\.3\}/);
  });
  test('popup 没有 5px 间距', () => {
    expect(pop).not.toMatch(/padding:\s*0 5px/);
    expect(v2).toMatch(/kbd\{[^}]*padding:2px 6px/);
  });
});
