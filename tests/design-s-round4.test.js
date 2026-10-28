// R4 设计复核非阻塞建议 S1–S9
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
import { translations } from '../src/config/locales';
import { ctxBadgeState } from '../src/ui/popup/ctx-badge';

describe('S1 没有 Key：卡片徽标中性「需要 Key」而不是 Failed', () => {
  test.each([['zh', '需要 Key'], ['en', 'Key needed']])('%s', (l, text) => {
    expect(ctxBadgeState({ state: 'needkey', kind: 'abs' }, translations[l])).toEqual(['idle', text]);
    expect(ctxBadgeState({ state: 'err', kind: 'abs' }, translations[l])[0]).toBe('err');
  });
  test('runExport 的无 Key 分支把状态设为 needkey', () => {
    expect(read('src/ui/popup/popup.js')).toMatch(/if \(!active\.hasKey\) \{[\s\S]{0,400}ctx\.state = 'needkey';\s*(\/\/[^\n]*)?\s*renderContext\(\);\s*return;/);
  });
});

const css = () => read('src/ui/popup/popup.css');
test('S2 行内后端名 .row .prov 为 11px', () => {
  expect(css()).toMatch(/\.row \.prov \{[^}]*font-size: 11px/);
  expect(css()).not.toMatch(/\.row \.prov \{[^}]*font-size: 10px/);
});

describe('design S3: row actions right-aligned, awaiting title >= 80px', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
  test('row-act has margin-left:auto', () => {
    expect(css).toMatch(/\.row \.row-act\{[^}]*margin-left:auto/);
  });
  test('provider label hidden below 379px', () => {
    expect(css).toMatch(/@media \(max-width:378px\)\{\.row \.prov\{display:none\}\}/);
  });
  test('awaiting title min-width 80px', () => {
    expect(css).toMatch(/\.row\[data-status="awaiting_consent"\] \.n\{min-width:80px\}/);
  });
  test('provider name kept in title tooltip', () => {
    const js = require('fs').readFileSync(require('path').join(__dirname, '../src/ui/popup/task-list.js'), 'utf8');
    expect(js).toMatch(/\$\{title\} · \$\{providerLabel\(task\.provider\)\}/);
  });
});

describe('design S4: requires-key chip not uppercased', () => {
  test('settings.css sets text-transform:none on the key chip', () => {
    const css = require('fs').readFileSync(require('path').join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
    expect(css).toMatch(/\.mode-badge\[data-i18n="mode_requires_token"\]\s*\{\s*text-transform:\s*none;/);
  });
});

describe('design S5', () => {
  test('en paddle desc names the Key', () => {
    expect(translations.en.pdf_desc_paddleocr).toMatch(/access token \(Key\)\.$/);
  });
});

describe('design S6', () => {
  test('en forbidden_empty reason is capitalized', () => {
    expect(translations.en.err_reason_forbidden_empty).toMatch(/^Request was rejected/);
  });
});

describe('design S7', () => {
  test('zh incomplete detail uses 『』 for the inner quote', () => {
    expect(translations.zh.content_result_incomplete).toContain('『PDF（标题）』');
    expect(translations.zh.content_result_incomplete).not.toContain('「PDF（标题）」');
  });
});
