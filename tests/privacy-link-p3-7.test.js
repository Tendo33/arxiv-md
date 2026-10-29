/** P3-7：PaddleOCR 隐私链接指向飞桨星河社区（AI Studio）自己的隐私政策（19:2x 实测 HTTP 200） */
import { PRIVACY_LINKS } from '../src/ui/settings/disclosure';
import { translations } from '../src/config/locales';

test('链接与文字', () => {
  expect(PRIVACY_LINKS.paddleocr).toBe('https://aistudio.baidu.com/privacy');
  expect(translations.en.pdf_disc_link_paddleocr).toBe('Baidu AI Studio privacy policy (in Chinese)');
  expect(translations.zh.pdf_disc_link_paddleocr).toBe('飞桨星河社区隐私政策（中文）');
});
