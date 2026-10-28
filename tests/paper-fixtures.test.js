/**
 * 真实 arXiv HTML 离线夹具的回归测试。夹具是 CC BY / CC0 论文的正文裁剪片段
 * （scripts/crop-fixtures.mjs 生成，来源与许可见 tests/fixtures/papers/README.md 及各文件头注释）：
 * - Markdown 快照
 * - 所有公式都能被 KaTeX 解析
 * - 公式数量不明显少于原文 <math> 数量
 * - 不残留内部占位符，不出现旧的 [注^: 脚注写法、空 mailto 链接和 SVG 图丢失
 */
import fs from 'fs';
import path from 'path';
import {
  FIXTURE_DIR,
  listPaperFixtures,
  convertFixture,
  extractFormulas,
  katexErrors,
  countSourceMath,
} from './helpers/paper-fixtures';

const fixtures = listPaperFixtures();

describe('arXiv HTML 夹具转换', () => {
  test('至少有 10 篇夹具', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  test('夹具 + 快照总量 ≤ 500 KB，且每篇注明来源和 CC 许可', () => {
    const snapDir = path.join(__dirname, '__snapshots__');
    const total = [
      ...fixtures.map((f) => path.join(FIXTURE_DIR, f)),
      ...fs.readdirSync(snapDir).map((f) => path.join(snapDir, f)),
    ].reduce((sum, f) => sum + fs.statSync(f).size, 0);
    expect(total).toBeLessThanOrEqual(500 * 1024);
    fixtures.forEach((f) => {
      const head = fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8').slice(0, 400);
      expect(head).toMatch(new RegExp(`source: https://arxiv\\.org/html/${f.replace('.html', '').replace('.', '\\.')}`));
      expect(head).toMatch(/license: CC(?: BY 4\.0|0 1\.0) https:\/\/creativecommons\.org\//);
    });
  });

  describe.each(fixtures)('%s', (file) => {
    let markdown;
    beforeAll(() => {
      markdown = convertFixture(file);
    });

    test('Markdown 快照', () => {
      expect(markdown).toMatchSnapshot();
    });

    test('公式全部可被 KaTeX 解析', () => {
      const { display, inline } = extractFormulas(markdown);
      const errors = [...katexErrors(display, true), ...katexErrors(inline, false)];
      expect(errors).toEqual([]);
    });

    test('公式没有明显丢失', () => {
      const { display, inline } = extractFormulas(markdown);
      const source = countSourceMath(file);
      expect(display.length + inline.length).toBeGreaterThanOrEqual(Math.floor(source * 0.85));
    });

    test('没有占位符残留和旧脚注写法', () => {
      expect(markdown).not.toMatch(/MATH(INLINE|BLOCK)START|ARXIVMD[A-Z]+\d*END|ARXIVMDBIBANCHOR/);
      expect(markdown).not.toContain('[注^');
      expect(markdown).not.toMatch(/\]\(mailto:\)/);
    });

    test('正文引用可跳转到参考文献', () => {
      const ids = [...markdown.matchAll(/\]\(#(bib\.[\w.-]+)\)/g)].map((m) => m[1]);
      expect(ids.length).toBeGreaterThan(0);
      ids.forEach((id) => expect(markdown).toContain(`<a id="${id}"></a>`));
    });

    test('<object> SVG 图被保留为图片链接', () => {
      const html = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
      const svgs = [...html.matchAll(/<object[^>]*type="image\/svg\+xml"[^>]*data="([^"]+)"/g)].map((m) => m[1]);
      svgs.forEach((data) => expect(markdown).toContain(`(https://arxiv.org/html/${data})`));
    });
  });
});
