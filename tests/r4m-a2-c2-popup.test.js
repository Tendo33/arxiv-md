// R4 合入：设计建议 A2（「打开设置」独占一行）、C2（只有待确认行时才保证列表最小高度）
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');

describe('A2：#alertKey 的「打开设置」按钮独占一行', () => {
  test('display:block + width:max-content，保留 6px 上间距', () => {
    expect(css).toMatch(/#alertKey \.btn-refresh\{display:block;width:max-content\}/);
    expect(css).toMatch(/#alertKey \.btn-refresh\{margin-top:6px\}/);
  });
});

describe('C2：只在有待确认行时给 #taskList 最小高度', () => {
  test('默认只保证一整行 46px（不能是 0：窄宽下会被 flex 压成半行）', () => {
    expect(css).toMatch(/#taskList\{[^}]*min-height:46px;/);
    expect(css).not.toMatch(/#taskList\{[^}]*min-height:72px/);
  });
  test(':has(待确认行) 时 72px', () => {
    expect(css).toMatch(/#taskList:has\(\.row\[data-status=awaiting_consent\]\)\{min-height:72px\}/);
  });
});
