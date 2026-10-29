// 设计裁定 R-2（QA 6a49976 R-2）：等待说明在标题/元信息之下、是行内最后一个元素，margin-top 4px，role=status
import { createTaskRow } from '../src/ui/popup/task-list';
import { parseHTML } from 'linkedom';
const fs = require('fs');
const path = require('path');
const { document } = parseHTML('<!doctype html><html><body></body></html>');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('DOM：.row-note 是最后一个子元素，排在 .n / .row-act 之后', () => {
  const row = createTaskRow({ id: 'd', status: 'pending', provider: 'paddleocr', dnrReinitWaitSince: 1, createdAt: Date.now(), paperInfo: { title: 'T' } }, document);
  const kids = [...row.children];
  const note = row.querySelector('.row-note');
  expect(row.lastElementChild).toBe(note);
  expect(note.getAttribute('role')).toBe('status');
  expect(kids.indexOf(note)).toBeGreaterThan(kids.indexOf(row.querySelector('.n')));
  expect(kids.indexOf(note)).toBeGreaterThan(kids.indexOf(row.querySelector('.row-act')));
});
test('CSS：order 排在 ≤340 的 .n(2)/.row-err(3) 之后，margin-top 4px，12/18 --text-2', () => {
  const m = css.match(/\.row \.row-note\{([^}]*)\}/);
  expect(m).toBeTruthy();
  expect(m[1]).toMatch(/order:4/);
  expect(m[1]).toMatch(/margin-top:4px/);
  expect(m[1]).toMatch(/font-size:12px;line-height:18px;color:var\(--text-2\)/);
});
test('package.json test:e2e 含 e2e-popup-dnr-note.js', () => {
  expect(require('../package.json').scripts['test:e2e']).toContain('node scripts/e2e-popup-dnr-note.js');
});
