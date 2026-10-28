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
