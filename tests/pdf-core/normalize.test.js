// R4-09：统一整理流程
import { normalizeMarkdown, normalizeMath, normalizeTables, htmlTableToGfm, normalizeImages, shouldNormalize, buildFrontMatter } from '@pdf-core/normalize/index';
import { mineruProvider } from '@pdf-core/providers/mineru';
import { paddleocrProvider } from '@pdf-core/providers/paddleocr';

const fs = require('fs');
const path = require('path');
const MD = fs.readFileSync(path.join(__dirname, '../fixtures/providers/paddleocr/result.md'), 'utf8');

describe('math', () => {
  test('\\( \\) → $ $，\\[ \\] → $$ $$', () => {
    expect(normalizeMath('a \\( x+1 \\) b')).toBe('a $x+1$ b');
    expect(normalizeMath('\\[E=mc^2\\]')).toBe('$$E=mc^2$$');
    expect(normalizeMath('\\[\nA\\\\\nB\n\\]')).toBe('$$\nA\\\\\nB\n$$');
  });
  test('代码块和行内代码不动；已有 $ 不动', () => {
    const src = '```\n\\(x\\)\n```\n`\\[y\\]` and $z$';
    expect(normalizeMath(src)).toBe(src);
  });
});

describe('table', () => {
  const simple = '<table><tr><th>a</th><th>b|c</th></tr><tr><td>1</td><td>2&amp;3</td></tr></table>';
  test('默认保留 HTML', () => { expect(normalizeTables(simple)).toBe(simple); });
  test('toGfm 只转简单表', () => {
    expect(htmlTableToGfm(simple)).toBe('| a | b\\|c |\n| --- | --- |\n| 1 | 2&3 |');
    const merged = '<table><tr><td colspan="2">x</td></tr><tr><td>1</td><td>2</td></tr></table>';
    expect(normalizeTables(merged, { toGfm: true })).toBe(merged);
    expect(htmlTableToGfm('<table><tr><td rowspan=1>a</td></tr></table>')).toBe('| a |\n| --- |');
    expect(htmlTableToGfm('<table><tr><td>a</td></tr><tr><td>1</td><td>2</td></tr></table>')).toBeNull();
    expect(htmlTableToGfm('<table></table>')).toBeNull();
    expect(htmlTableToGfm('<table><tr><td><table><tr><td>x</td></tr></table></td></tr></table>')).toBeNull();
  });
});

describe('images', () => {
  test('统一命名 figures/fig-{页}-{序号}，md 与 <img> 同步改，重复引用同名', () => {
    const src = '![](imgs/page_2_a.jpg)\n<img src="imgs/page_2_b.PNG" />\n![x](imgs/page_2_a.jpg "t")\n![](imgs/other.jpeg)\n![](https://x.invalid/a.png)';
    const r = normalizeImages(src);
    expect(r.markdown).toBe('![](figures/fig-2-1.jpg)\n<img src="figures/fig-2-2.png" />\n![x](figures/fig-2-1.jpg "t")\n![](figures/fig-1-1.jpeg)\n![](https://x.invalid/a.png)');
    expect(r.images).toHaveLength(3);
  });
  test('自定义 pageOf', () => {
    expect(normalizeImages('![](a)', { pageOf: () => 7 }).markdown).toBe('![](figures/fig-7-1.png)');
  });
});

describe('normalizeMarkdown', () => {
  test('PaddleOCR fixture：公式统一、front-matter、有图 → zip', () => {
    const r = normalizeMarkdown(MD, { meta: { title: 'A: B', arxivId: '2401.00001', source: 'paddleocr', authors: ['X', 'Y'], year: 2024 } });
    expect(r.markdown.startsWith('---\ntitle: "A: B"\narxiv_id: 2401.00001\nsource: paddleocr\nauthors: X, Y\nyear: 2024\n---\n')).toBe(true);
    expect(r.markdown).toContain('$a+b$');
    expect(r.markdown).toContain('$$E = mc^2$$');
    expect(r.markdown).not.toMatch(/\\\(|\\\[/);
    expect(r.markdown).toContain('<table>');
    expect(r.deliver).toBe('zip');
    expect(r.images[0].to).toBe('figures/fig-1-1.jpg');
  });
  test('没图 → md；无 meta 不加 front-matter；tablesToGfm', () => {
    const r = normalizeMarkdown('<table><tr><td>a</td></tr></table>', { tablesToGfm: true });
    expect(r.deliver).toBe('md');
    expect(r.markdown).toBe('| a |\n| --- |\n');
  });
  test('front-matter 与 ar5iv 字段一致；可替换已有 front-matter', () => {
    expect(buildFrontMatter({ title: 't' })).toBe('---\ntitle: t\n---\n');
    const r = normalizeMarkdown('---\ntitle: old\n---\nbody', { meta: { title: 'new' } });
    expect(r.markdown).toBe('---\ntitle: new\n---\n\nbody\n');
  });
  test('MinerU 默认不走整理流程（开关默认关），PaddleOCR 走', () => {
    expect(shouldNormalize(paddleocrProvider)).toBe(true);
    expect(shouldNormalize(mineruProvider)).toBe(false);
    expect(shouldNormalize(mineruProvider, { normalizeMinerU: true })).toBe(true);
    expect(shouldNormalize(null)).toBe(false);
  });
});
