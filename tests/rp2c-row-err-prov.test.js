// rp2c（设计终验 ①）：≤378px 时失败原因前显示「{后端} · 」（aria-hidden，读屏不重复；title 只有原因）；宽屏隐藏
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createTaskRow, setTaskListLanguage } from '../src/ui/popup/task-list';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
const { document } = parseHTML('<html><body></body></html>');

test.each([['zh', 'paddleocr', 'PaddleOCR'], ['en', 'mineru', 'MinerU']])('%s 失败行：前缀在原因内、aria-hidden、title 不含后端名', (lang, provider, label) => {
  setTaskListLanguage(lang);
  const row = createTaskRow({ id: 1, status: 'failed', provider, errorCode: 'QUOTA_EXCEEDED', error: 'x', paperInfo: { title: 'T' }, createdAt: Date.now() }, document);
  const err = row.querySelector('.row-err');
  const pre = err.firstChild;
  expect(pre.className).toBe('row-err-prov');
  expect(pre.getAttribute('aria-hidden')).toBe('true');
  expect(pre.textContent).toBe(`${label} · `);
  expect(err.getAttribute('title')).not.toContain(label);
  // 读屏可见的后端名只有 .prov 一处
  const readable = [...row.querySelectorAll('*')].filter((n) => !n.closest('[aria-hidden="true"]') && n.textContent === label);
  expect(readable.map((n) => n.className)).toEqual(['prov']);
  setTaskListLanguage('en');
});

test('非失败行没有前缀', () => {
  const row = createTaskRow({ id: 2, status: 'completed', provider: 'mineru', zipUrl: 'https://a/b.zip', paperInfo: { title: 'T' }, createdAt: Date.now() }, document);
  expect(row.querySelector('.row-err-prov')).toBeNull();
});

test('CSS：默认隐藏，≤378px inline；仍在两行截断的 .row-err 内', () => {
  expect(css).toMatch(/\.row \.row-err-prov\{display:none;color:var\(--text-2\);font-weight:500\}/);
  expect(css).toMatch(/@media \(max-width:378px\)\{\.row \.row-err-prov\{display:inline\}\}/);
  expect(css).toMatch(/\.row \.row-err\{display:-webkit-box;[^}]*-webkit-line-clamp:2/);
});
