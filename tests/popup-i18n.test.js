import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.html'), 'utf8');
const CJK = /[\u4e00-\u9fff]/;

describe('popup 文案全部走 i18n（英文界面不出现中文）', () => {
  test('删除确认对话框的提示和按钮有 data-i18n，且中英文都有译文', () => {
    const { document } = parseHTML(html);
    for (const [id, key] of [['confirmMessage', 'popup_confirm_delete'], ['confirmCancel', 'popup_btn_cancel'], ['confirmOk', 'popup_btn_confirm']]) {
      expect(document.getElementById(id).getAttribute('data-i18n')).toBe(key);
      expect(translations.en[key]).toBeTruthy();
      expect(CJK.test(translations.en[key])).toBe(false);
      expect(CJK.test(translations.zh[key])).toBe(true);
    }
  });

  test('套用英文译文后，可见文本和 aria-label 里没有中文', () => {
    const { document } = parseHTML(html);
    document.querySelectorAll('script, style').forEach((el) => el.remove());
    const t = translations.en;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = t[el.getAttribute('data-i18n')];
      expect(v).toBeTruthy();
      el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', t[el.getAttribute('data-i18n-title')]));
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t[el.getAttribute('data-i18n-aria')]));
    const leftovers = [];
    const walk = (node) => {
      if (node.nodeType === 3 && CJK.test(node.textContent)) leftovers.push(node.textContent.trim());
      if (node.nodeType === 1) {
        for (const a of ['title', 'aria-label', 'placeholder', 'alt']) {
          if (CJK.test(node.getAttribute(a) || '')) leftovers.push(`${a}=${node.getAttribute(a)}`);
        }
        node.childNodes.forEach(walk);
      }
    };
    walk(document.body);
    expect(leftovers).toEqual([]);
  });
});

describe('R4-15 popup 文案泛化', () => {
  test('按钮、任务区和空状态不再写死 MinerU；按钮旁有后端小字', () => {
    const { document } = parseHTML(html);
    for (const key of ['popup_btn_mineru', 'popup_recent', 'popup_recent_empty', 'popup_empty_title', 'popup_err_token_hint']) {
      expect(translations.en[key]).not.toMatch(/MinerU/);
      expect(translations.zh[key]).not.toMatch(/MinerU/);
    }
    expect(translations.zh.popup_btn_mineru).toBe('PDF 解析');
    expect(translations.en.popup_recent).toBe('PDF parsing tasks');
    expect(document.getElementById('backendLabel')).toBeTruthy();
    expect(document.getElementById('mineruBtn').getAttribute('aria-describedby')).toBe('backendLabel');
  });

  test('任务行显示后端标签（老记录没有 provider 按 MinerU）', () => {
    const { createTaskRow } = require('../src/ui/popup/task-list');
    const base = { id: 't1', status: 'completed', paperInfo: { title: 'X' }, createdAt: Date.now() };
    expect(createTaskRow({ ...base, provider: 'paddleocr' })).toContain('<span class="prov">PaddleOCR</span>');
    expect(createTaskRow(base)).toContain('<span class="prov">MinerU</span>');
  });
});
