import katex from 'katex';
import { parseHTML, Node } from 'linkedom';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { cleanLatexFormula } from '../src/content/ar5iv-math';

beforeAll(() => {
  global.Node = Node;
});

const conv = (body) => convertAr5ivDocument(
  parseHTML(`<!doctype html><html><body><article>${body}</article></body></html>`).document,
);

const renders = (tex, displayMode = false) => {
  expect(() => katex.renderToString(tex, {
    throwOnError: true, displayMode, strict: 'ignore',
  })).not.toThrow();
};

describe('LaTeX 兼容性（MathJax / KaTeX 都能渲染）', () => {
  test('\\bm 换成 \\boldsymbol（MathJax 默认没有 bm 宏）', () => {
    expect(cleanLatexFormula('\\bm{M}_{s+1}')).toBe('\\boldsymbol{M}_{s+1}');
    expect(cleanLatexFormula('\\bm{M}')).not.toContain('\\bm');
    renders(cleanLatexFormula('\\bm{M}_{s+1}=\\bm{A}\\bm{B}'));
  });

  test('\\textnormal 换成 \\text，\\textsc 换成 \\text', () => {
    expect(cleanLatexFormula('\\textnormal{softmax}')).toBe('\\text{softmax}');
    expect(cleanLatexFormula('\\textsc{Name}')).toBe('\\text{Name}');
    renders(cleanLatexFormula('\\textnormal{softmax}(x)'));
  });

  test('\\bmod 不会被误当成 \\bm', () => {
    const out = cleanLatexFormula('k=s\\bmod K');
    expect(out).toContain('\\bmod');
    expect(out).not.toContain('\\boldsymbolod');
    renders(out);
  });

  test('正文公式转换后全部可渲染（\\bm + 下标 + 分式）', () => {
    const md = conv(`<p>Value <math alttext="\\bm{h}_{s+1}\\in\\mathbb{R}^{d}"><mi>h</mi></math> stays.</p>`);
    expect(md).not.toContain('\\bm');
    const tex = md.match(/\$([^$]+)\$/)[1];
    renders(tex);
  });

  test('\\text{…} 里的数学命令不破坏渲染，也不丢内容', () => {
    // \bm 在 text 模式下非法，KaTeX 会整条报错
    expect(cleanLatexFormula('\\text{\\bm{x}}')).toBe('\\text{x}');
    renders(cleanLatexFormula('\\text{\\bm{x}}'));
    // 文本里的 \times 要变成可见的 ×，不能连同内容一起删掉
    const times = cleanLatexFormula('\\text{3\\times 3}');
    expect(times).toContain('×');
    renders(times);
    // 文本字体命令本身在 text 模式下合法，必须保留
    expect(cleanLatexFormula('\\text{\\textbf{bold}}')).toBe('\\text{\\textbf{bold}}');
    // 含 $…$ 的文本组交给 splitDollarsInTextGroups，公式体内容不丢
    const dollars = cleanLatexFormula('\\text{3$\\times$3}');
    expect(dollars).toContain('\\times');
    renders(dollars);
  });

  test('\\diag 等自定义算子仍按原规则处理', () => {
    expect(cleanLatexFormula('\\text{\\diag} A')).toBe('\\text{diag} A');
    const out = cleanLatexFormula('\\bm{\\sigma}^{2}=\\diag(\\bm{\\Sigma})');
    expect(out).toContain('\\operatorname{diag}');
    renders(out);
  });
});

describe('多行方程表', () => {
  const equationGroup = `
    <table class="ltx_equationgroup ltx_eqn_table"><tbody>
      <tr class="ltx_equation ltx_eqn_row"><td class="ltx_eqn_cell"></td>
        <td class="ltx_td ltx_align_right ltx_eqn_cell"><math alttext="\\displaystyle\\bm{M}_{s+1}" display="inline"><mi>M</mi></math></td>
        <td class="ltx_td ltx_align_left ltx_eqn_cell"><math alttext="\\displaystyle=\\bm{M}_{s}\\bm{W}_{s}+\\bm{v}_{s}\\bm{b}_{s}^{\\top}," display="inline"><mi>x</mi></math></td>
        <td class="ltx_eqn_cell ltx_eqn_eqno" rowspan="2"><span class="ltx_tag ltx_tag_equationgroup">(6)</span></td>
      </tr>
      <tr class="ltx_equation ltx_eqn_row"><td class="ltx_eqn_cell"></td>
        <td class="ltx_td ltx_align_right ltx_eqn_cell"><math alttext="\\displaystyle\\bm{h}_{s+1}" display="inline"><mi>h</mi></math></td>
        <td class="ltx_td ltx_align_left ltx_eqn_cell"><math alttext="\\displaystyle=\\bm{M}_{s+1}\\bm{r}_{s}." display="inline"><mi>y</mi></math></td>
      </tr>
    </tbody></table>`;

  test('一条多行公式合并成一个 display 块，不再拆成 4 个 $$', () => {
    const md = conv(equationGroup);
    const blocks = md.match(/\$\$/g) || [];
    expect(blocks.length).toBe(2); // 一个 $$…$$ 的开闭
    expect(md).toContain('\\begin{aligned}');
    expect(md).toContain('\\end{aligned}');
    const tex = md.match(/\$\$([\s\S]+?)\$\$/)[1];
    renders(tex, true);
  });

  test('公式编号保留为 \\tag', () => {
    const md = conv(equationGroup);
    expect(md).toContain('\\tag{6}');
  });

  test('单行方程不额外包 aligned', () => {
    const md = conv(`<table class="ltx_equation ltx_eqn_table"><tbody><tr class="ltx_equation ltx_eqn_row">
      <td class="ltx_eqn_cell"></td>
      <td class="ltx_eqn_cell"><math alttext="\\bm{\\delta}_{s}=f_{k}(\\bm{x}_{s})-\\bm{x}_{s}." display="block"><mi>d</mi></math></td>
      <td class="ltx_eqn_cell ltx_eqn_eqno"><span class="ltx_tag ltx_tag_equation">(1)</span></td>
    </tr></tbody></table>`);
    expect(md).not.toContain('\\begin{aligned}');
    expect(md).toContain('\\tag{1}');
    renders(md.match(/\$\$([\s\S]+?)\$\$/)[1], true);
  });
});

describe('表格里的公式', () => {
  test('单元格里的 display 公式降级为行内，表格不被赶回 HTML', () => {
    const md = conv(`<table class="ltx_tabular"><tr><th>Method</th><th>Read</th></tr>
      <tr><td>Linear</td><td><span class="ltx_inline-block"><span class="ltx_p"><math alttext="\\displaystyle\\frac{\\bm{q}_{s}}{\\bm{z}_{s+1}^{\\top}\\bm{q}_{s}}" display="inline"><mi>q</mi></math></span></span></td></tr></table>`);
    expect(md).not.toContain('<table');
    expect(md).toContain('| Method | Read |');
    expect(md).toContain('$\\dfrac{');
    const tex = md.match(/\$([^$]+)\$/)[1];
    renders(tex);
  });

  test('单元格里的分式升级为 \\dfrac（行内不被压成小号）', () => {
    const md = conv(`<table class="ltx_tabular"><tr><th>A</th></tr>
      <tr><td><math alttext="\\displaystyle\\frac{\\bm{q}}{\\bm{z}}" display="inline"><mi>q</mi></math></td></tr></table>`);
    expect(md).toContain('$\\dfrac{');
    renders(md.match(/\$([^$]+)\$/)[1]);
  });

  test('colspan 表格转 GFM 且跨列补空格子', () => {
    const md = conv(`<table class="ltx_tabular"><tr><th colspan="2">Head</th></tr>
      <tr><td>a</td><td>b</td></tr></table>`);
    expect(md).not.toContain('<table');
    expect(md).toContain('| Head |   |');
  });
});

describe('作者行', () => {
  test('去掉单位、"Equal contribution" 和多余空格', () => {
    const md = conv(`<div class="ltx_authors">
      <span class="ltx_creator"><span class="ltx_personname">Xuan Ouyang
      </span></span>
      <span class="ltx_author_before">  </span><span class="ltx_creator"><span class="ltx_personname">Zefan Cai
      </span><span class="ltx_author_notes"><span class="ltx_contact ltx_role_affiliation"><span class="ltx_contact_name">Affiliation: </span>UW-Madison</span></span></span>
      <span class="ltx_author_before">  </span><span class="ltx_creator"><span class="ltx_personname"><sup class="ltx_sup">*</sup>Equal contribution
      </span></span></div>`);
    expect(md).toContain('Xuan Ouyang, Zefan Cai');
    expect(md).not.toContain('Affiliation');
    expect(md).not.toContain('Equal contribution');
    expect(md).not.toMatch(/Ouyang ,/);
  });

  test('纯单位条目不会粘成一个假作者', () => {
    const md = conv(`<div class="ltx_authors">
      <span class="ltx_creator"><span class="ltx_personname">Chelsea Finn
      </span></span>
      <span class="ltx_author_before">  </span><span class="ltx_creator"><span class="ltx_personname"><span class="ltx_note"><sup class="ltx_note_mark">2</sup></span> Stanford University CZ Biohub
      </span></span></div>`);
    expect(md).toContain('Chelsea Finn');
    expect(md).not.toContain('Stanford University');
  });

  test('用 <span> 包住的真实姓名不能被误删', () => {
    const md = conv(`<div class="ltx_authors">
      <span class="ltx_creator"><span class="ltx_personname"><span class="ltx_text ltx_font_bold">Ada Lovelace</span></span></span>
      <span class="ltx_author_before">  </span><span class="ltx_creator"><span class="ltx_personname"><span class="ltx_text">Alan Turing</span></span></span></div>`);
    expect(md).toContain('Ada Lovelace');
    expect(md).toContain('Alan Turing');
  });

  test('同一作者条目里用 & 并列的两个人保留分隔', () => {
    // ar5iv 会把 "Stefan Schoepf & Alexandra Brintrup" 放在同一个 personname 里
    const md = conv(`<div class="ltx_authors">
      <span class="ltx_creator"><span class="ltx_personname">Jack Foster
      </span></span>
      <span class="ltx_author_before">  </span><span class="ltx_creator"><span class="ltx_personname">Stefan Schoepf &amp; Alexandra Brintrup
      </span></span></div>`);
    expect(md).toMatch(/Jack Foster,\s*Stefan Schoepf,\s*Alexandra Brintrup/);
  });
});

describe('正文残留清理', () => {
  test('拆分公式后不留下只含空格的孤行', () => {
    const md = conv('<p><math alttext="a"><mi>a</mi></math><math alttext="b"><mi>b</mi></math></p>');
    expect(md).not.toMatch(/^[ \t]+$/m);
  });

  test('Turndown 转义的连字符还原', () => {
    // 真实结构：<math> 后紧跟 "-dimensional"，Turndown 会把行内文本开头的 - 转义成 \-
    const md = conv('<p>$d$<span></span>-dimensional vectors and a value of <span></span>-0.60.</p>');
    expect(md).toContain('$d$-dimensional');
    expect(md).toContain('-0.60');
    expect(md).not.toMatch(/(?<!\\)\\-/);
  });

  test('&#160; 等数字实体被解码', () => {
    const md = conv('<p>20&#160;TPP and 3&#215;3 patches.</p>');
    expect(md).not.toContain('&#');
    expect(md).toContain('20 TPP');
  });

  test('控制字符实体不会打断表格行', () => {
    const md = conv(`<table class="ltx_tabular"><tr><th>A</th><th>B</th></tr>
      <tr><td>x&#10;y</td><td>z</td></tr></table>`);
    expect(md).not.toContain('&#');
    // 解码出的换行若原样保留，GFM 表格会被切断
    const tableLine = md.split('\n').find((l) => l.includes('| x'));
    expect(tableLine).toBeTruthy();
    expect(tableLine).toContain('| z |');
  });
});
