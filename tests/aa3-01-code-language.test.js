/**
 * AA3-01：2402.19173 附录 A.3 的 license_file_names 代码块（ltx_verbatim，源 HTML 不带语言）要标成 ```python。
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { parseHTML, Node } from 'linkedom';
import ar5ivConverter from '../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { guessCodeLanguage } from '../src/content/ar5iv-turndown-rules';

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
    expect(guessCodeLanguage('for i = 1 to n do\n  s <- s + a[i]\nend for')).toBe('');
    expect(guessCodeLanguage('pattern = re.compile(r"^a+$")')).toBe('python');
  });
});
