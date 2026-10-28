/**
 * AF3-01：arxiv.org/html/2402.19173 的 §4 有 LaTeXML 生成的不规范 `</li></li>`，
 * linkedom 解析时把 article 提前闭合，§4 后半段、§5 以后全部丢失。
 * 夹具来自真实页面（CC BY-SA 4.0），min 为最小复现片段，article.html.gz 为整篇正文区。
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { parseHTML, Node } from 'linkedom';
import ar5ivConverter, { rescueEscapedContent } from '../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../src/content/markdown-convert';

const DIR = path.join(__dirname, 'fixtures', 'af3');

function convert(html) {
  global.Node = Node;
  const cleaned = ar5ivConverter.cleanHtml(html);
  const { document } = parseHTML(`<!doctype html><html><body>${cleaned.content}</body></html>`);
  return convertAr5ivDocument(document, { assetPageUrl: 'https://arxiv.org/html/2402.19173' });
}

describe('AF3-01 不规范 </li></li> 不再截断正文', () => {
  test('最小片段：§4 列表之后的 §5 仍然导出，页脚不混入', () => {
    const md = convert(fs.readFileSync(path.join(DIR, '2402.19173-min.html'), 'utf8'));
    expect(md).toMatch(/^## 5\s/m);
    expect(md).toContain('TypeScript');
    expect(md).not.toContain('footer');
  });

  test('整篇正文区：§1–§10 与附录 A–C 全部导出，代码清单保留', () => {
    const html = zlib.gunzipSync(fs.readFileSync(path.join(DIR, '2402.19173-article.html.gz'))).toString('utf8');
    const md = convert(html);
    for (let n = 1; n <= 10; n += 1) expect(md).toMatch(new RegExp(`^## ${n}\\s`, 'm'));
    ['A', 'B', 'C'].forEach((a) => expect(md).toMatch(new RegExp(`^## \\(Appendix ${a}\\)`, 'm')));
    expect(md).toContain('```');
    expect(md.length).toBeGreaterThan(150000);
  });

  test('rescueEscapedContent 只收正文节点，不收页脚/导航', () => {
    const { document } = parseHTML('<html><body><div class="ltx_page_main"><article class="ltx_document"><p>a</p></article>'
      + '<section class="ltx_section" id="S5">b</section><footer class="ltx_page_footer">f</footer><nav class="ltx_TOC">n</nav></div>'
      + '<div id="fixed-buttons-container">x</div></body></html>');
    const article = document.querySelector('article');
    expect(rescueEscapedContent(article)).toBe(1);
    expect(article.querySelector('#S5')).not.toBeNull();
    expect(article.textContent).not.toContain('f');
  });

  // 审查 P2-1：body 级的 ul/section 不能被收进来
  test('rescueEscapedContent 不收 body 级的 <ul class="menu"> 和 <section id="cookie">', () => {
    const { document } = parseHTML('<html><body><div class="ltx_page_main"><article class="ltx_document"><p>a</p></article>'
      + '<section class="ltx_section" id="S5">b</section></div>'
      + '<ul class="menu"><li>menu</li></ul><section id="cookie">cookie</section></body></html>');
    const article = document.querySelector('article');
    expect(rescueEscapedContent(article)).toBe(1);
    expect(article.querySelector('#S5')).not.toBeNull();
    expect(article.querySelector('ul.menu')).toBeNull();
    expect(article.querySelector('#cookie')).toBeNull();
  });

  test('rescueEscapedContent 只收 ltx_ 节点，祖先只走到最外层 .ltx_page_main 为止', () => {
    const { document } = parseHTML('<html><body><div class="wrapper"><div class="ltx_page_main"><div class="ltx_page_content">'
      + '<article class="ltx_document"><p>a</p></article><ul class="share"><li>s</li></ul></div>'
      + '<section class="ltx_section" id="S5">b</section></div>'
      + '<section class="ltx_section" id="S6">c</section></div>'
      + '<div class="ltx_para" id="outside">o</div></body></html>');
    const article = document.querySelector('article');
    // 最外层 page_main 后面的兄弟（#S6）还要收（真实页面正文就落在这里），再往上的 #outside 不收
    expect(rescueEscapedContent(article)).toBe(2);
    expect(article.querySelector('#S5')).not.toBeNull();
    expect(article.querySelector('#S6')).not.toBeNull();
    expect(article.querySelector('ul.share')).toBeNull();
    expect(article.querySelector('#outside')).toBeNull();
  });
});
