/**
 * 设计裁定 R-2（原话「左边与标题文字对齐」）：.row-note 的左缘 = .n 的左缘。
 * alignRowNotes 量出差值写进 --note-indent；CSS 用它做 margin-left，并从 flex-basis 扣掉。
 */
const fs = require('fs');
const path = require('path');
const { alignRowNotes } = require('../src/ui/popup/task-list');

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');

function fakeList(nLeft, noteLeft) {
  const props = {};
  const style = { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } };
  const note = { getBoundingClientRect: () => ({ left: noteLeft }) };
  const n = { getBoundingClientRect: () => ({ left: nLeft }) };
  const row = { style, querySelector: (s) => (s === '.row-note' ? note : s === '.n' ? n : null) };
  return { list: { querySelectorAll: () => [row] }, props };
}

describe('R-2 备注左缘对齐标题文字', () => {
  test('标题在徽标之后（360/375）：缩进 = 标题左缘 − 备注自然左缘', () => {
    const { list, props } = fakeList(81.5, 26);
    alignRowNotes(list);
    expect(props['--note-indent']).toBe('55.5px');
  });
  test('标题换到整行（≤340）：不缩进', () => {
    const { list, props } = fakeList(26, 26);
    alignRowNotes(list);
    expect(props['--note-indent']).toBeUndefined();
  });
  test('没有列表 / 没有备注时不报错', () => {
    expect(() => alignRowNotes(null)).not.toThrow();
    expect(() => alignRowNotes({ querySelectorAll: () => [{ querySelector: () => null, style: {} }] })).not.toThrow();
  });
  test('CSS 用 --note-indent 做左外边距并从 flex-basis 扣掉（不溢出）', () => {
    const rule = css.match(/\.row \.row-note\{[^}]*\}/)[0];
    expect(rule).toMatch(/margin-left:var\(--note-indent,0px\)/);
    expect(rule).toMatch(/flex-basis:calc\(100% - var\(--note-indent,0px\)\)/);
  });
  test('popup 每次渲染任务行后都对齐', () => {
    const js = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.js'), 'utf8');
    expect(js).toMatch(/renderTaskRows\(\$\('taskList'\), list, document\);[\s\S]{0,120}alignRowNotes\(\$\('taskList'\)\)/);
  });
});
