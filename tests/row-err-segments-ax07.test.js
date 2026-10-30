// 设计附录 D3（AX-07）：任务行错误原因按语义段包 .nw；分段拼起来必须等于 locales 原句
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';
import { ZH_ROW_ERR_SEGMENTS, rowErrSegments } from '../src/ui/popup/row-err-segments';
import { createTaskRow, setTaskListLanguage } from '../src/ui/popup/task-list';

const zh = translations.zh;
const KEYS = ['err_short_QUOTA_EXCEEDED', 'err_short_RATE_LIMITED', 'err_short_AUTH_INVALID', 'err_short_TOO_LARGE', 'err_short_NETWORK',
  'err_short_TIMEOUT', 'err_short_permission_plain', 'err_short_failed_plain', 'err_short_reason_forbidden_empty',
  'err_short_reason_key_not_on_device', 'err_reason_empty_result', 'err_short_FILE_UNSUPPORTED'];

test('设计列出的 12 句 + {host} 句：分段拼接 = zh 原句', () => {
  expect(ZH_ROW_ERR_SEGMENTS.map((s) => s.join('')).sort()).toEqual(KEYS.map((k) => zh[k]).sort());
  expect(rowErrSegments(zh.err_short_PERMISSION_MISSING.replace('{host}', 'paddleocr.aistudio-app.com'))).toEqual(['无法访问 ', 'paddleocr.aistudio-app.com，', '请重启浏览器', '后重试']);
  expect(rowErrSegments(translations.en.err_short_NETWORK)).toBeNull();
});

test.each([['zh', 3], ['en', 0]])('%s 失败行渲染 .nw 段数', (lang, n) => {
  setTaskListLanguage(lang);
  const { document } = parseHTML('<html><body></body></html>');
  const row = createTaskRow({ id: 'x', status: 'failed', errorCode: 'QUOTA_EXCEEDED', provider: 'mineru', paperInfo: { title: 'T' }, createdAt: Date.now() }, document);
  const err = row.querySelector('.row-err');
  expect(err.querySelectorAll('.nw').length).toBe(n);
  expect(err.textContent).toContain(translations[lang].err_short_QUOTA_EXCEEDED);
  setTaskListLanguage('zh');
});

test('CSS：.row-err .nw 不断行', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
  expect(css).toMatch(/\.row-err \.nw\{white-space:nowrap\}/);
});
