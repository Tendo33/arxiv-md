// 设计 18:16 #1 / 主管 18:17 #1：披露确认按钮文案
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/config/locales.js'), 'utf8');
const disc = fs.readFileSync(path.join(__dirname, '../src/ui/settings/disclosure.js'), 'utf8');
test('pdf_disc_ok en/zh copy without {provider}', () => {
  expect(src).toContain("pdf_disc_ok: 'Confirm and continue',");
  expect(src).toContain("pdf_disc_ok: '确认并继续',");
  expect(src).not.toMatch(/pdf_disc_ok: '[^']*\{provider\}/);
});
test('confirm button uses plain tr.pdf_disc_ok (no fmt vars)', () => {
  expect(disc).toMatch(/pd-ok' \}, tr\.pdf_disc_ok\)/);
});
