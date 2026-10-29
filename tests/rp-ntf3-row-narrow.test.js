// release-polish 设计 NTF3：320px 任务行标题布局
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');

test('≤340px：标题 flex-basis:100% 换到第二行，失败原因排在标题后', () => {
  expect(css).toContain('@media (max-width:340px){.row .n{flex-basis:100%;order:2;min-width:0}.row .row-err{order:3}}');
});
test('任务行仍然可换行（flex-wrap:wrap）', () => {
  expect(css).toMatch(/\.row\{flex-wrap:wrap;row-gap:2px\}/);
});
