// release-polish 设计 B1：PDF 解析任务提交后显示「已提交 / Submitted」，不再是「已完成 / 已保存」
import fs from 'fs';
import path from 'path';
import { ctxBadgeState } from '../src/ui/popup/ctx-badge';
import { translations } from '../src/config/locales';

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('B1 徽标', () => {
  test.each(['zh', 'en'])('%s：submitted → 等待样式 +「已提交」', (lang) => {
    const tr = translations[lang];
    expect(ctxBadgeState({ state: 'submitted', kind: 'abs' }, tr)).toEqual(['wait', tr.content_progress_submitted]);
    expect(ctxBadgeState({ state: 'ok', kind: 'abs' }, tr)).toEqual(['ok', tr.popup_badge_ok]);
  });
  test('文案：zh 已提交 / en Submitted', () => {
    expect(translations.zh.content_progress_submitted).toBe('已提交');
    expect(translations.en.content_progress_submitted).toBe('Submitted');
  });
});

describe('B1 提示框', () => {
  const js = read('src/ui/popup/popup.js');
  const html = read('src/ui/popup/popup.html');
  test('popup.html 不再写死「已保存」', () => {
    expect(html).not.toContain('data-i18n="popup_saved"');
    expect(html).toContain('<b id="okTitle"></b>');
  });
  test('showOk 带 title 参数；PDF 解析用「已提交」标题和 submitted 状态', () => {
    expect(js).toMatch(/function showOk\(text, title = null, state = 'ok'\)/);
    expect(js).toContain("$('okTitle').textContent = title || t().popup_saved;");
    expect(js).toContain("tr.content_progress_submitted, 'submitted')");
  });
  test('正文指向「PDF 解析任务」，不重复「已提交」，中文用「」', () => {
    expect(translations.zh.popup_saved_bg).toContain('「PDF 解析任务」');
    expect(translations.zh.popup_saved_bg).not.toContain('已提交');
    expect(translations.en.popup_saved_bg).toContain('PDF parsing tasks');
    expect(translations.zh.popup_recent).toBe('PDF 解析任务');
  });
});
