// rp2c 设计增量复核建议：英文空正文卡片与按钮用词一致（"PDF parsing"）
import { translations as LOCALES } from '../src/config/locales';

test('en content_result_empty 用 "use PDF parsing"', () => {
  expect(LOCALES.en.content_result_empty).toMatch(/use PDF parsing to get Markdown/);
  expect(LOCALES.en.content_result_empty).not.toMatch(/PDF parse\b/);
  expect(LOCALES.en.popup_btn_mineru).toBe('PDF parsing');
});
