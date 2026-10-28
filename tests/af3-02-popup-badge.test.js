// AF3-02：popup 任务行状态标签在 320px 下不得折行（「处理中」曾折成两行）
const fs = require('fs');
const path = require('path');

describe('AF3-02 popup task badge', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
  const rule = (css.match(/\.row \.badge\s*\{([^}]*)\}/) || [])[1] || '';
  test('badge does not wrap', () => expect(rule).toMatch(/white-space:\s*nowrap/));
  test('badge does not shrink', () => expect(rule).toMatch(/flex:\s*none/));
});
