// Round 3：arxiv 设计复验建议 1（popup toast 用 token）、建议 2（英文统计区句首大写统一）
const fs = require('fs');
const path = require('path');
const { translations } = require('../src/config/locales');

test('popup .toast 不再硬编码 rgba(36,27,25,.9)，改用 token', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
  expect(css).not.toMatch(/rgba\(36,\s*27,\s*25/);
  expect(css).toMatch(/\.toast\{[^}]*background:var\(--text-primary\);color:var\(--surface\)/);
});

test('英文统计区标签统一句首大写', () => {
  const en = translations.en;
  const keys = ['stats_title', 'stats_total', 'stats_ar5iv', 'stats_mineru', 'stats_pdf', 'stats_reset'];
  expect(keys.map((k) => en[k])).toEqual(['Usage statistics', 'Total conversions', 'HTML success', 'MinerU success', 'PDF fallback', 'Reset statistics']);
  const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
  expect(html).not.toMatch(/Total Conversions|PDF Fallback|Usage Statistics|Reset Statistics/);
});
