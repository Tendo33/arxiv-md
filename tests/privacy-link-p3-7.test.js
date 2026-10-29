/** P3-7：PaddleOCR 隐私链接指向飞桨星河社区（AI Studio）自己的隐私政策（19:2x 实测 HTTP 200） */
import { PRIVACY_LINKS } from '../src/ui/settings/disclosure';
import { translations } from '../src/config/locales';

test('链接与文字', () => {
  expect(PRIVACY_LINKS.paddleocr).toBe('https://www.baidu.com/duty/yinsiquan.html');
  expect(translations.en.pdf_disc_link_paddleocr).toBe('Baidu privacy policy (in Chinese)');
  expect(translations.zh.pdf_disc_link_paddleocr).toBe('百度隐私权保护声明（中文）');
});

test('C14 最终版：PRIVACY.md 两个链接都列，aistudio 那份注明只适用于微信小程序、移动端浏览器（不含PC端）', () => {
  const md = require('fs').readFileSync(require('path').join(__dirname, '../PRIVACY.md'), 'utf8');
  expect(md).toContain('[Baidu privacy policy (in Chinese)](https://www.baidu.com/duty/yinsiquan.html)');
  expect(md).toContain('(https://aistudio.baidu.com/privacy)');
  expect(md).toContain('微信小程序、移动端浏览器（不含PC端）');
  const cn = require('fs').readFileSync(require('path').join(__dirname, '../README_CN.md'), 'utf8');
  expect(cn).toContain('微信小程序、移动端浏览器（不含PC端）');
});
