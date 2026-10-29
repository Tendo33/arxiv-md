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
