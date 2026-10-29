/** 审查 P3-c：扩展重载后旧页面点按钮 → 提示刷新（复用 content_error_extension_reloaded，不新增文案） */
import { statusCardErrorText, isContextInvalidated } from '../src/content/status-error';
import { translations } from '../src/config/locales';

test.each(['zh', 'en'])('%s：sendMessage 抛 Extension context invalidated → 刷新提示', (lang) => {
  const t = translations[lang];
  expect(statusCardErrorText(new Error('Extension context invalidated.'), t, 'Conversion trigger failed'))
    .toBe(t.content_error_extension_reloaded);
  expect(statusCardErrorText(new Error('Extension context invalidated.'), t, 'PDF download failed', { download: true }))
    .toBe(t.content_error_extension_reloaded);
});

test('别的异常不受影响', () => {
  const t = translations.zh;
  expect(statusCardErrorText(new Error('Invalid filename'), t)).not.toBe(t.content_error_extension_reloaded);
  expect(isContextInvalidated({ error: 'Extension context invalidated' })).toBe(false);
  expect(isContextInvalidated(null)).toBe(false);
});
