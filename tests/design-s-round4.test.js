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
  test('N1: provider label only visually hidden below 379px (never display:none)', () => {
    expect(css).toMatch(/@media \(max-width:378px\)\{\.row \.prov\{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect\(0 0 0 0\);white-space:nowrap;border:0;padding:0\}\}/);
    expect(css).not.toMatch(/\.prov\{display:none/);
    expect(css).toMatch(/\.row\{position:relative\}/);
  });
  test('awaiting title min-width 80px', () => {
    expect(css).toMatch(/\.row\[data-status="awaiting_consent"\] \.n\{min-width:80px\}/);
  });
  test('N1: provider name read once (in .prov), not repeated in the title tooltip', () => {
    const { createTaskRow } = require('../src/ui/popup/task-list');
    const html = createTaskRow({ id: 'p', status: 'awaiting_consent', provider: 'mineru', paperInfo: { title: 'Paper T' }, createdAt: Date.now() });
    expect(html).toContain('title="Paper T"');
    expect(html).toContain('<span class="prov">MinerU</span>');
    expect(html.split('MinerU').length - 1).toBe(1);
  });
});

describe('design S4 + suggestion B: chips keep sentence case', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
  test('.mode-badge has no uppercase / letter-spacing and no per-chip override', () => {
    const block = css.match(/\.mode-badge \{[^}]*\}/)[0];
    expect(block).not.toMatch(/text-transform/);
    expect(block).not.toMatch(/letter-spacing/);
    expect(css).not.toMatch(/\.mode-badge\[data-i18n="mode_requires_token"\]/);
    expect(css).not.toMatch(/text-transform:\s*uppercase/);
  });
  test('en copy is sentence case', () => {
    expect(translations.en.mode_requires_token).toBe('Requires key');
    expect(translations.en.mode_recommended).toBe('Recommended');
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

describe('design S8: failed row has no duplicate title', () => {
  test('error appears once, only in .row-err', () => {
    const { createTaskRow } = require('../src/ui/popup/task-list');
    const html = createTaskRow({ id: 'x', status: 'failed', error: 'Boom here', paperInfo: { title: 'T' }, provider: 'paddleocr' });
    const rowTag = html.match(/^<div class="row"[^>]*>/)[0];
    expect(rowTag).not.toMatch(/\stitle=/);
    expect(html).toContain('<span class="row-err">Boom here</span>');
    expect(html.split('Boom here').length - 1).toBe(1);
  });
});

describe('design S9: ⚠ only marks the incomplete notification', () => {
  test('consent title has no ⚠ in zh/en', () => {
    for (const lang of ['zh', 'en']) {
      expect(translations[lang].notify_task_consent_title).not.toMatch(/⚠/);
      expect(translations[lang].notify_task_consent_title).toMatch(/^\S/);
    }
  });
});
