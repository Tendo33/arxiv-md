/**
 * batch8 ①（batch7 审查 P3-1 + batch6 复审 P3）：
 * - 提示词标记只在行首且不在引号里才算模板；拼提示词的真 Python 保留 python 标签。
 * - 伪代码的 Step/Input/Output/Algorithm 行是排他特征，伪代码里写 re.compile 也不标 python。
 */
import { guessCodeLanguage, guessPythonByHints, isPromptTemplate } from '../src/content/ar5iv-turndown-rules';

describe('batch8 拼提示词的 Python 仍是 python（正例）', () => {
  test.each([
    ['f-string [INST]', 'import torch\ndef build(q):\n    prompt = f"[INST] {q} [/INST]"\n    return prompt'],
    ["单引号 '[INST]'", "from typing import List\ndef wrap(q):\n    return '[INST] ' + q + ' [/INST]'"],
    ['<<SYS>> 字符串', 'import os\nSYS = "<<SYS>>\\nYou are helpful.\\n<</SYS>>"\ndef f():\n    return SYS'],
    ['ChatML 字符串', "def chat(m):\n    return '<|im_start|>user\\n' + m + '<|im_end|>'"],
    ['三引号里行首 [INST]', 'import json\nTEMPLATE = """\n[INST] <<SYS>>\nbe nice\n<</SYS>>\n{q} [/INST]\n"""\ndef render(q):\n    return TEMPLATE.format(q=q)'],
    ['注释里单独的 ### Response:', 'import re\n### Response: parse model output\ndef parse(s):\n    return s.strip()'],
  ])('%s', (_n, code) => {
    expect(isPromptTemplate(code)).toBe(false);
    expect(guessCodeLanguage(code)).toBe('python');
  });

  test('拼提示词 + re/join 的 ltx_verbatim 片段 guessPythonByHints 仍为 true', () => {
    const code = 'pat = re.compile(r"\\[INST\\](.*?)\\[/INST\\]")\nparts = ", ".join(xs)\nq = "[INST] hi [/INST]"';
    expect(isPromptTemplate(code)).toBe(false);
    expect(guessPythonByHints(code)).toBe(true);
  });
});

describe('batch8 真提示词模板仍不标（反例）', () => {
  test.each([
    ['行首 [INST] 带撇号', "[INST] Don't explain, write code.\ndef f(x):\n    return x\n[/INST]"],
    ['缩进的 <<SYS>>', '  <<SYS>>\n  You are a bot.\n  <</SYS>>\nimport os'],
    ['Alpaca 两段都在', '## Instruction:\nWrite add.\n## Response:\ndef add(a, b):\n    return a + b'],
  ])('%s', (_n, code) => {
    expect(isPromptTemplate(code)).toBe(true);
    expect(guessCodeLanguage(code)).toBe('');
    expect(guessPythonByHints(code)).toBe(false);
  });
});

describe('batch8 伪代码含 re.compile 不标 python', () => {
  test.each([
    ['Step + re.compile + self.', 'Step 1: pat = re.compile(r"\\d+")\nStep 2: self.items = pat.findall(text)  # all numbers'],
    ['Input/Output', 'Input: text, pattern\nOutput: matches\nm = re.match(r"a", text), # first\nreturn m'],
    ['Algorithm 1', 'Algorithm 1: Filter\nfor each line:\n    if re.search(r"x", line): self.keep(line)'],
  ])('%s', (_n, code) => {
    expect(guessPythonByHints(code)).toBe(false);
  });

  test('变量名 Output/Steps 的真 Python 不被排他规则误伤', () => {
    expect(guessPythonByHints('Output = re.compile(r"\\w+")\nsteps = ", ".join(xs)')).toBe(true);
  });
});

test('stripQuoted 在病态输入下不退化', () => {
  for (const s of ['"'.repeat(200000), "'a".repeat(100000), '"""' + 'x'.repeat(200000), ('"\\'.repeat(50000)) + '\n']) {
    const t0 = Date.now();
    isPromptTemplate(s);
    expect(Date.now() - t0).toBeLessThan(200);
  }
});
