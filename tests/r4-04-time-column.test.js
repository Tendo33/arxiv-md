// R4-04：任务列表时间列 tabular-nums + 固定最小宽度
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createTaskRow } from '../src/ui/popup/task-list';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
test('时间 <small> 带 class t', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const row = createTaskRow({ id: 1, status: 'completed', paperInfo: { title: 'T' }, createdAt: Date.now() - 600000 }, document);
  expect(row.querySelector('small.t')).toBeTruthy();
});
test('CSS：.row .t 等宽数字、最小宽度、右对齐', () => {
  const rule = css.match(/\.row \.t,\.row \.pct\{([^}]*)\}/);
  expect(rule).toBeTruthy();
  expect(rule[1]).toMatch(/font-variant-numeric:tabular-nums/);
  expect(rule[1]).toMatch(/min-width:4\.5em/);
  expect(rule[1]).toMatch(/text-align:right/);
});
