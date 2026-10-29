const fs = require('fs');
const path = require('path');
import { translations } from '@config/locales';

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('设计验收 M1：模式卡、页面按钮、进度、统计不再写死 MinerU', () => {
  test('模式卡：PDF 解析模式 / 需要 Key（中英）', () => {
    expect(translations.zh.mode_mineru_title).toBe('PDF 解析模式');
    expect(translations.zh.mode_requires_token).toBe('需要 Key');
    expect(translations.en.mode_mineru_title).toBe('PDF parsing mode');
    expect(translations.en.mode_requires_token).toBe('Requires key');
    const html = read('src/ui/settings/settings.html');
    expect(html).not.toMatch(/MinerU mode|Always use MinerU|Requires token|MinerU success/);
  });

  test('页面按钮、进度、重复确认、统计里不出现具体后端名；进度用 {provider}', () => {
    for (const l of ['zh', 'en']) {
      const tr = translations[l];
      for (const k of ['mode_mineru_title', 'mode_mineru_desc', 'mode_requires_token', 'stats_mineru',
        'content_mode_mineru', 'content_progress_submitting', 'content_progress_processing',
        'content_progress_parsing', 'content_confirm_duplicate']) {
        expect(`${l}.${k}: ${tr[k]}`.split(': ')[1]).not.toMatch(/MinerU|Token|token/);
      }
      expect(tr.content_mode_mineru).toMatch(/\{provider\}/);
      expect(tr.content_progress_submitting).toMatch(/\{provider\}/);
      expect(tr.content_progress_parsing).toMatch(/\{provider\}/);
      expect(tr.content_progress_processing).not.toMatch(/\{provider\}/);
    }
  });

  test('旧的「MinerU API 配置」区文案已删除（设置页早已不用）', () => {
    for (const l of ['zh', 'en']) {
      expect(Object.keys(translations[l]).filter((k) => /^mineru_(title|desc|token_|visit|hint|about|feature|quota)/.test(k))).toEqual([]);
    }
  });

  test('README 中英都叫 PDF 解析模式', () => {
    expect(read('README.md')).not.toMatch(/MinerU mode/);
    expect(read('README_CN.md')).not.toMatch(/MinerU 模式/);
  });

  test('进度条把 {provider} 换成当前后端名', () => {
    const { parseHTML } = require('linkedom');
    global.document = parseHTML('<html><body><div class="arxiv-md-progress"><span class="progress-text"></span><span class="progress-percent"></span><span class="progress-detail"></span></div></body></html>').document;
    const ui = require('../src/content/progress-ui');
    ui.setProgressText(translations.zh);
    ui.setProgressProvider('paddleocr');
    ui.updateProgressUI({ stage: 'submitting', progress: 10 });
    expect(document.querySelector('.progress-text').textContent).toBe('正在发送给 PaddleOCR…');
    ui.updateProgressUI({ stage: 'processing', progress: 50 });
    expect(document.querySelector('.progress-text').textContent).toBe('PaddleOCR 正在解析…');
    ui.setProgressProvider(undefined);
    ui.updateProgressUI({ stage: 'processing', progress: 50 });
    expect(document.querySelector('.progress-text').textContent).toBe('MinerU 正在解析…');
  });

  test('页面按钮读取 pdfProvider 并替换占位', () => {
    const src = read('src/content/page-buttons.js');
    expect(src).toMatch(/chrome\.storage\.sync\.get\(\['conversionMode', 'pdfProvider'\]\)/);
    expect(src).toMatch(/content_mode_mineru\.replace\('\{provider\}', providerLabel\(pdfProvider\)\)/);
  });
});
