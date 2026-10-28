import { parseHTML, Node } from 'linkedom';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { guessCodeLanguage } from '../src/content/ar5iv-turndown-rules';

beforeAll(() => { global.Node = Node; });
const conv = (body) => convertAr5ivDocument(parseHTML(`<!doctype html><html><body><article>${body}</article></body></html>`).document);

describe('R1-03 表格', () => {
  test('单元格公式含 | 的简单表格输出 GFM，| 被转义', () => {
    const md = conv(`<table class="ltx_tabular">
      <tr><td>Batch Size</td><td><math alttext="|\\Theta|"><mi>Θ</mi></math></td></tr>
      <tr><td>16</td><td>4.7M</td></tr></table>`);
    expect(md).not.toContain('<table');
    expect(md).toContain('| Batch Size | $\\|\\Theta\\|$ |');
    expect(md).toContain('| --- | --- |');
  });
  test('已有 \\| 的范数公式也能正确转义', () => {
    const md = conv(`<table class="ltx_tabular"><tr><td>a</td><td><math alttext="\\|x\\|"><mi>x</mi></math></td></tr></table>`);
    expect(md).toContain('$\\\\|x\\\\|$');
  });
  test('有合并单元格仍回退 HTML', () => {
    expect(conv(`<table class="ltx_tabular"><tr><td colspan="2">x</td></tr></table>`)).toContain('<table');
  });
});

describe('R1-03 代码块语言', () => {
  test('DPO 的 PyTorch 代码带 python 标记', () => {
    const md = conv(`<p>code:</p><pre class="ltx_verbatim ltx_font_typewriter">
import torch.nn.functional as F

def dpo_loss(pi_logps, ref_logps, beta):
    return -F.logsigmoid(beta)
</pre>`);
    expect(md).toMatch(/```python\nimport torch\.nn\.functional as F\n\ndef dpo_loss/);
  });
  test('猜不出语言时不写标记', () => {
    expect(guessCodeLanguage('x := y + 1')).toBe('');
    expect(guessCodeLanguage('pip install torch')).toBe('bash');
    expect(guessCodeLanguage('{"a": 1}')).toBe('json');
    expect(guessCodeLanguage('#include <stdio.h>\nint main(){}')).toBe('cpp');
  });
});
