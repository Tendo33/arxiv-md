/**
 * AB6-01：后处理去 HTML 标签残留时，不能吃掉代码块 / 行内代码 / 公式里的 <NAME>、<EMAIL>、<PROOFSTEP>、List<String> 等。
 * fixture 为 arxiv.org/html 原文（2026-10-29 抓取）gzip。
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { parseHTML, Node } from 'linkedom';
import ar5ivConverter from '../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { postProcessMarkdown } from '../src/content/markdown-postprocess';

const exportMd = (id) => {
  global.Node = Node;
  const html = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures', 'ab6', `${id}-article.html.gz`))).toString('utf8');
  const cleaned = ar5ivConverter.cleanHtml(html);
  const { document } = parseHTML(`<!doctype html><html><body>${cleaned.content}</body></html>`);
  return convertAr5ivDocument(document, { assetPageUrl: `https://arxiv.org/html/${id}` });
};

describe('AB6-01 尖括号内容保留', () => {
  test('2305.06161 PII 模板：<NAME>, <EMAIL>, <KEY>, <PASSWORD> 都在', () => {
    const md = exportMd('2305.06161');
    for (const tok of ['<NAME>', '<EMAIL>', '<KEY>', '<PASSWORD>']) expect(md).toContain(tok);
  });

  test('2009.03393 Metamath：<PROOFSTEP> 与 <P|N> 都在', () => {
    const md = exportMd('2009.03393');
    expect(md).toContain('<PROOFSTEP>');
    expect(md).toContain('<P|N>');
  });

  test('代码块、行内代码、公式原样；正文里的真实标签残留仍清理', () => {
    const src = [
      '正文 <span class="x">保留文字</span> 和 <p>段</p>',
      '',
      '```java',
      'List<String> a; Map<Integer, String> m; std::vector<int> v; <em>raw</em>',
      '```',
      '',
      '行内 `Map<Integer, String>` 与 `<b>` 以及公式 $a<b$ and $c>d$',
      '',
      '$$',
      'x<p>y',
      '$$',
    ].join('\n');
    const out = postProcessMarkdown(src);
    expect(out).toContain('正文 保留文字 和 段');
    expect(out).toContain('List<String> a; Map<Integer, String> m; std::vector<int> v; <em>raw</em>');
    expect(out).toContain('`Map<Integer, String>` 与 `<b>`');
    expect(out).toContain('$a<b$ and $c>d$');
    expect(out).toContain('x<p>y');
  });

  test('正文里不是标签的尖括号（<EMAIL>、<P|N>）也不删', () => {
    expect(postProcessMarkdown('填 <EMAIL> 或 <P|N> 或 <strong>粗</strong>')).toContain('填 <EMAIL> 或 <P|N> 或 粗');
  });
});
