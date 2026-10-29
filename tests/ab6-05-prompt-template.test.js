/**
 * AB6-05：2308.12950（Code Llama）Fig.11/12 等提示词模板含 [INST] … [PYTHON] def …，不应标 ```python。
 * fixture：arxiv.org/html/2308.12950 原文（2026-10-29 抓取）gzip。
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { parseHTML, Node } from 'linkedom';
import ar5ivConverter from '../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { guessCodeLanguage, guessPythonByHints } from '../src/content/ar5iv-turndown-rules';

const FIG12 = [
  '[INST] Your task is to write a Python function to solve a programming problem.',
  'The Python code must be between [PYTHON] and [/PYTHON] tags.',
  'Problem: Write a Python function to get the unique elements of a list.',
  'Test: assert get_unique_elements([1, 2, 3, 2, 1]) == [1, 2, 3]',
  '[/INST]',
  '[PYTHON]',
  'def get_unique_elements(my_list):',
  '    return list(set(my_list))',
  '[/PYTHON]',
].join('\n');

describe('AB6-05 提示词模板不标 python', () => {
  test.each([
    ['Fig.12 [INST]/[PYTHON]', FIG12],
    ['<<SYS>>', '<<SYS>>\nYou are a helpful assistant.\n<</SYS>>\nimport os\nprint(os.getcwd())'],
    ['ChatML', '<|im_start|>user\nfrom typing import List\ndef f(x):\n    return x\n<|im_end|>'],
    ['### Instruction', '### Instruction:\nWrite code.\n### Response:\ndef add(a, b):\n    return a + b'],
  ])('%s', (_n, code) => {
    expect(guessCodeLanguage(code)).toBe('');
    expect(guessPythonByHints(code)).toBe(false);
  });

  test('真 Python 不受影响（正例保持）', () => {
    expect(guessCodeLanguage('import numpy as np\nx = np.zeros(3)')).toBe('python');
    expect(guessCodeLanguage('def get_unique_elements(my_list):\n    return list(set(my_list))')).toBe('python');
    expect(guessCodeLanguage('# list[int] index\nclass A:\n    pass')).toBe('python');
  });

  test('2308.12950 全文：含 [INST] 的代码块都不带 python 标记', () => {
    global.Node = Node;
    const html = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures/ab6/2308.12950-article.html.gz'))).toString('utf8');
    const cleaned = ar5ivConverter.cleanHtml(html);
    const { document } = parseHTML(`<!doctype html><html><body>${cleaned.content}</body></html>`);
    const md = convertAr5ivDocument(document, { assetPageUrl: 'https://arxiv.org/html/2308.12950' });
    const blocks = [...md.matchAll(/^(`{3,})(\w*)\n([\s\S]*?)\n\1$/gm)];
    const prompts = blocks.filter((m) => m[3].includes('[INST]'));
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.filter((m) => m[2] === 'python')).toHaveLength(0);
  });
});
