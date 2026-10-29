// 设计附录 D2（AX-04）：abs 页 PDF 下载中只把图标换成 spinner，文字保持原样，加 aria-busy，恢复时移除
import fs from 'fs';
import path from 'path';
const src = fs.readFileSync(path.join(__dirname, '../src/content/index.js'), 'utf8');
const fn = src.slice(src.indexOf('async function handlePdfDownloadDirect'), src.indexOf('async function handlePdfDownloadDirect') + 2500);

test('downloading keeps the label (icon swap only) and sets aria-busy', () => {
  expect(fn).toMatch(/setChildren\(button, svg\(document, ICON_SPINNER\), \.\.\.pdfButtonContent\(t\)\.slice\(1\)\)/);
  expect(fn).not.toMatch(/ICON_SPINNER\), t\.content_progress_downloading/);
  expect(fn).toMatch(/button\.setAttribute\('aria-busy', 'true'\)/);
  expect(fn).toMatch(/removeAttribute\('aria-busy'\)/);
});
test('e2e checks width delta 0 in en and zh', () => {
  const e2e = fs.readFileSync(path.join(__dirname, '../scripts/e2e-abs-buttons.js'), 'utf8');
  expect(e2e).toMatch(/r\.maxDelta !== 0/);
});
