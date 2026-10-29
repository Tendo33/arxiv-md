// 设计 C11 #1：拦截标题两家共用 pdf_disc_needed_title
const fs = require('fs');
const path = require('path');
const { translations } = require('../src/config/locales');
const { statusCardErrorText } = require('../src/content/status-error');
test('only shared key, exact copy', () => {
  expect(translations.zh.pdf_disc_needed_title).toBe('需要先确认数据说明');
  expect(translations.en.pdf_disc_needed_title).toBe("Review what's shared first");
  for (const l of ['zh', 'en']) for (const p of ['paddleocr', 'mineru']) expect(translations[l]).not.toHaveProperty(`pdf_disc_needed_title_${p}`);
  expect(fs.readFileSync(path.join(__dirname, '../src/content/status-error.js'), 'utf8')).not.toMatch(/pdf_disc_needed_title_/);
});
test('both providers use the shared title', () => {
  for (const provider of ['paddleocr', 'mineru']) {
    expect(statusCardErrorText({ disclosureNeeded: true, provider }, translations.zh)).toBe(`需要先确认数据说明。${translations.zh.pdf_disc_needed_body}`);
    expect(statusCardErrorText({ disclosureNeeded: true, provider }, translations.en)).toBe(`Review what's shared first. ${translations.en.pdf_disc_needed_body}`);
  }
});
