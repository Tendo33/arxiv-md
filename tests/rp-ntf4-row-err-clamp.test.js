// release-polish 设计 NTF4：失败原因两行截断，完整文本在 title
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createTaskRow, setTaskListLanguage } from '../src/ui/popup/task-list';
import { translations } from '../src/config/locales';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
const { document } = parseHTML('<html><body></body></html>');

test('.row-err 用 -webkit-line-clamp:2 截断', () => {
  expect(css).toMatch(/\.row \.row-err\{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden\}/);
});
test('title 是完整原文（含按语言翻译后的 errorReason）', () => {
  const long = 'x'.repeat(300);
  expect(createTaskRow({ id: 'a', status: 'failed', error: long, paperInfo: {}, createdAt: Date.now() }, document).querySelector('.row-err').getAttribute('title')).toBe(long);
  setTaskListLanguage('zh');
  const r = createTaskRow({ id: 'b', status: 'failed', provider: 'paddleocr', errorReason: 'key_not_on_device', error: 'raw', paperInfo: {}, createdAt: Date.now() }, document);
  const err = r.querySelector('.row-err');
  expect(err.getAttribute('title')).toBe(err.lastChild.textContent);
  expect(err.lastChild.textContent).toBe(translations.zh.err_short_reason_key_not_on_device);
});
