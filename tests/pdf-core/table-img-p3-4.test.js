/** P3-4：表格里的 <img> 保持 HTML，表格外的照常转成 ![]() */
import { imgTagsToMarkdown } from '@pdf-core/output/mineru-layout';

test('表格里的 img 不转，表格外的转', () => {
  const md = '<div><img src="images/a.jpg"></div>\n<table><tr><td><img src="images/b.jpg"></td></tr></table>\ntext <img src="images/c.png">\n<table><tr><td><img src="images/d.jpg"/></td></tr></table>';
  const out = imgTagsToMarkdown(md);
  expect(out).toContain('![](images/a.jpg)');
  expect(out).toContain('![](images/c.png)');
  const tables = out.match(/<table\b[\s\S]*?<\/table>/g);
  expect(tables).toHaveLength(2);
  expect(tables[0]).toContain('<img src="images/b.jpg">');
  expect(tables[1]).toContain('<img src="images/d.jpg"/>');
  for (const t of tables) expect(t).not.toMatch(/!\[\]\(/);
});
