// 设计 C12 / 主管 18:20：「通常比 MinerU 慢」保留，单独一行
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
const { translations } = require('../src/config/locales');
const { document } = parseHTML(html);
test('pc-note is its own line in PaddleOCR .pc-body, not inside .pc-desc; MinerU has none', () => {
  const note = document.getElementById('pcNote-paddleocr');
  expect(note.className).toBe('pc-note');
  expect(note.getAttribute('data-i18n')).toBe('pdf_card_paddleocr_slow');
  expect(note.parentElement.className).toBe('pc-body');
  expect(document.querySelector('.pc-desc .pc-note')).toBeNull();
  expect(document.querySelectorAll('.pc-note')).toHaveLength(1);
  expect(document.querySelector('input[value="paddleocr"]').getAttribute('aria-describedby')).toBe('pcDesc-paddleocr pcNote-paddleocr');
  expect(document.querySelector('input[value="mineru"]').getAttribute('aria-describedby')).toBe('pcDesc-mineru');
});
test('copy + style; cards have no align-self/height', () => {
  expect(translations.zh.pdf_card_paddleocr_slow).toBe('通常比 MinerU 慢。');
  expect(translations.en.pdf_card_paddleocr_slow).toBe('Usually slower than MinerU.');
  expect(css).toContain('.provider-card .pc-note { display:block; font-size:12px; line-height:18px; font-weight:400; color:var(--text-secondary); }');
  for (const m of css.matchAll(/\.provider-card\s*\{([^}]*)\}/g)) expect(m[1]).not.toMatch(/align-self|(^|;)\s*height/);
});
