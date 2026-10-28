/**
 * AA3-01：2402.19173 附录 A.3 的 license_file_names 代码块（ltx_verbatim，源 HTML 不带语言）要标成 ```python。
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { parseHTML, Node } from 'linkedom';
import ar5ivConverter from '../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { guessCodeLanguage, guessPythonByHints } from '../src/content/ar5iv-turndown-rules';

const article = () => zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures', 'af3', '2402.19173-article.html.gz'))).toString('utf8');

function exportMd(html) {
  global.Node = Node;
  const cleaned = ar5ivConverter.cleanHtml(html);
  const { document } = parseHTML(`<!doctype html><html><body>${cleaned.content}</body></html>`);
  return convertAr5ivDocument(document, { assetPageUrl: 'https://arxiv.org/html/2402.19173' });
}

describe('AA3-01 附录代码块语言标注', () => {
  test('2402.19173 附录 A.3 license_file_names 代码块标成 python', () => {
    const md = exportMd(article());
    const m = md.match(/(`{3,}|~{4,})(\w*)\n(license_file_names = \[)/);
    expect(m).not.toBeNull();
    expect(m[2]).toBe('python');
    // 同一篇里原本就标了 python 的块不受影响
    expect((md.match(/```python\n/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test('只命中一条 Python 写法、或伪代码，不标注', () => {
    expect(guessCodeLanguage('names = [\n  "a",\n  "b",\n]')).toBe('');
    expect(guessCodeLanguage('x := y + 1\nreturn x')).toBe('');
    expect(guessPythonByHints('names = [\n  "a",  # first\n]')).toBe(false); // 只有弱特征
    expect(guessPythonByHints('self.x = 1')).toBe(false);
    expect(guessPythonByHints('pattern = re.compile(r"^a+$")')).toBe(true);
    expect(guessPythonByHints('words = [\n  "a",\n]\nprint(" ".join(words))')).toBe(true);
  });

  // 审查 B1 实测误判样例：都不应标 python
  test.each([
    ['Ruby', 'class Point\n  def initialize(x)\n    @x = x  # store\n    self.origin = re.compile(r"x")\n  end\nend\nputs ", ".join(xs)'],
    ['Ruby 无 end 行', 'opts = {\n  verbose: true, # default\n}\nself.origin = opts\nputs "a".join(x)'],
    ['Julia', 'A = [\n  1, # first\n  2,\n]\nprintln(join(A, ", "))\nfor i in A\n  x = re.compile(r"x")\nend'],
    ['TOML', 'deps = [\n  "numpy", # core\n  "scipy",\n]\npattern = r"x"'],
    ['伪代码', 'x = [\n  self.weights * h, # see eq 3\n]\nfor i <- 1 to n do\n  y <- f"(x)"'],
    ['元组式', 'result = (\n  a + b, # sum\n)'],
    ['数学式', 'L = (\n  alpha * L_ce, # weighted\n  beta * L_kl\n)'],
    ['C', 'int a[] = {\n  1, 2, # not a comment\n};\nprintf(f"x");'],
    ['JS', 'const s = self.x\nconst t = [\'a\', \'b\'].join(", ")\nlet y = \'a\'.join(s)'],
    ['JS 无分号', 'self.x = items\nout = \'a\'.join(self.x) => 1'],
    ['R', 'x <- c(1, # one\n  2)\ny = (\n  x\n)\nz <- paste(r"a")'],
  ])('%s 不标 python', (name, code) => {
    expect(guessPythonByHints(code)).toBe(false);
    expect(guessCodeLanguage(code)).not.toBe('python');
  });

  test('触发范围：只对 ltx_verbatim，且源 HTML 已标语言时不覆盖', () => {
    const code = 'license_file_names = [\n    "legal",  # x\n]\nr = re.compile(rf"^x$", re.IGNORECASE)';
    const html = (cls) => `<div class="ltx_page_content"><div class="ltx_para"><pre class="${cls}">${code}</pre></div></div>`;
    const md = (cls) => {
      global.Node = Node;
      const { document } = parseHTML(`<!doctype html><html><body>${html(cls)}</body></html>`);
      return convertAr5ivDocument(document, { assetPageUrl: 'https://arxiv.org/html/x' });
    };
    const fence = (out) => (out.match(/```(\w*)\n/) || [])[1];
    expect(fence(md('ltx_verbatim ltx_font_typewriter'))).toBe('python');
    expect(fence(md('ltx_code'))).toBe('');
  });
});
