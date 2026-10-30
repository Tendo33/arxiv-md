// R4 合入：设计建议 A2（「打开设置」独占一行）、C2（只有需重试行时才保证列表最小高度）
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');

describe('A2：#alertKey 的「打开设置」按钮独占一行', () => {
  test('display:block + width:max-content，保留 6px 上间距', () => {
    expect(css).toMatch(/#alertKey \.btn-refresh\{display:block;width:max-content\}/);
    expect(css).toMatch(/#alertKey \.btn-refresh\{margin-top:6px\}/);
  });
});

describe('C2：只在有需重试行时给 #taskList 最小高度', () => {
  test('默认只保证一整行 46px（不能是 0：窄宽下会被 flex 压成半行）', () => {
    expect(css).toMatch(/#taskList\{[^}]*min-height:46px;/);
    expect(css).not.toMatch(/#taskList\{[^}]*min-height:72px/);
  });
  test(':has(需重试行) 时 72px', () => {
    expect(css).toMatch(/#taskList:has\(\.row\[data-status=awaiting_consent\]\)\{min-height:72px\}/);
  });
});

describe('复审 P3③ / 设计 M1：320 下 .acts 保持双列，任务行不被页脚压住', () => {
  test('popup.css 里不再有把 .acts 改成单列的规则；.body 仍是 overflow:hidden（设计没选滚动兜底）', () => {
    expect(css).not.toMatch(/\.acts\{grid-template-columns:1fr\}/);
    expect(css).toMatch(/^\.body\{display:flex;flex-direction:column;overflow:hidden\}/m);
  });
  test('#taskList 注释写的是 46px / 72px，不是过时的单一 72px 说法', () => {
    expect(css).toContain('列表最小高度默认 46px（一整行），含需重试行时 72px');
  });
  test('e2e-popup-tasklist 断言行和按钮的 bottom ≤ .ft 的 top，覆盖 zh/en × 320/360/375', () => {
    const e2e = fs.readFileSync(path.join(__dirname, '../scripts/e2e-popup-tasklist.js'), 'utf8');
    expect(e2e).toContain('f.rowBottom <= f.ftTop');
    expect(e2e).toContain('b.bottom <= f.ftTop');
    expect(e2e).toMatch(/for \(const w of \[320, 360, 375\]\)/);
    expect(e2e).toMatch(/for \(const lang of \['zh', 'en'\]\)/);
  });
});
