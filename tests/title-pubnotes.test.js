/**
 * 标题里的 pubnotes（\thanks，结构仿 1406.2661 GAN 的 LaTeXML 输出，手写最小片段）：
 * 不能混进标题，也不能丢——要作为脚注出现在正文末尾。
 */
import { parseHTML, Node } from 'linkedom';
import ar5ivConverter from '../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../src/content/markdown-convert';

const html = `<!doctype html><html><body><article class="ltx_document">
<h1 class="ltx_title ltx_title_document">Generative Adversarial Nets<span class="ltx_pubnotes"><span class="ltx_pubnotes_content"><span class="ltx_pubnote ltx_role_thanks"><span class="ltx_note_name">Thanks: </span><span class="ltx_text ltx_font_bold">A is visiting B.</span></span><span class="ltx_pubnote ltx_role_thanks"><span class="ltx_note_name">Thanks: </span><span class="ltx_text ltx_font_bold">C is a Fellow.</span></span></span></span></h1>
<div class="ltx_para"><p class="ltx_p">Body text.</p></div>
</article></body></html>`;

test('标题 pubnotes 转成脚注，标题本身保持干净', () => {
  global.Node = Node;
  const cleaned = ar5ivConverter.cleanHtml(html);
  expect(cleaned.title).toBe('Generative Adversarial Nets');
  const { document } = parseHTML(`<!doctype html><html><body>${cleaned.content}</body></html>`);
  const md = convertAr5ivDocument(document, { assetPageUrl: 'https://arxiv.org/html/1406.2661' });
  expect(md).toMatch(/^# Generative Adversarial Nets\[\^1\]\[\^2\]$/m);
  expect(md).toMatch(/^\[\^1\]: A is visiting B\.$/m);
  expect(md).toMatch(/^\[\^2\]: C is a Fellow\.$/m);
  expect(md).not.toMatch(/Thanks:/);
});
