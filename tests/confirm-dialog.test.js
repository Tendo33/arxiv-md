import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';
import { showConfirm } from '../src/ui/popup/confirm-dialog';

describe('Round 2 审查：删除确认对话框会弹出', () => {
  let document;
  beforeEach(() => {
    const html = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.html'), 'utf8');
    ({ document } = parseHTML(html));
    global.document = document;
  });
  afterEach(() => { delete global.document; });

  test('初始隐藏且 inert；调用后可见、显示 i18n 文案；取消后恢复隐藏', async () => {
    const overlay = document.getElementById('confirmOverlay');
    expect(overlay.hidden).toBe(true);
    expect(overlay.hasAttribute('inert')).toBe(true);
    for (const lang of ['zh', 'en']) {
      const p = showConfirm(translations[lang].popup_confirm_delete);
      expect(overlay.hidden).toBe(false);
      expect(overlay.hasAttribute('inert')).toBe(false);
      expect(overlay.classList.contains('show')).toBe(true);
      expect(document.getElementById('confirmMessage').textContent).toBe(translations[lang].popup_confirm_delete);
      document.getElementById('confirmCancel').dispatchEvent(new document.defaultView.Event('click'));
      await expect(p).resolves.toBe(false);
      expect(overlay.hidden).toBe(true);
      expect(overlay.hasAttribute('inert')).toBe(true);
    }
  });

  test('确定返回 true', async () => {
    const p = showConfirm(translations.zh.popup_confirm_delete);
    document.getElementById('confirmOk').dispatchEvent(new document.defaultView.Event('click'));
    await expect(p).resolves.toBe(true);
  });
});
