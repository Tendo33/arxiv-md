/** C14 最终版：PRIVACY.md 两个百度链接都列，aistudio 那份注明只适用于微信小程序、移动端浏览器（不含PC端） */
test('C14 最终版：PRIVACY.md 两个链接都列，aistudio 那份注明只适用于微信小程序、移动端浏览器（不含PC端）', () => {
  const md = require('fs').readFileSync(require('path').join(__dirname, '../PRIVACY.md'), 'utf8');
  expect(md).toContain('[Baidu privacy policy (in Chinese)](https://www.baidu.com/duty/yinsiquan.html)');
  expect(md).toContain('(https://aistudio.baidu.com/privacy)');
  expect(md).toContain('微信小程序、移动端浏览器（不含PC端）');
  const cn = require('fs').readFileSync(require('path').join(__dirname, '../README_CN.md'), 'utf8');
  expect(cn).toContain('微信小程序、移动端浏览器（不含PC端）');
});
