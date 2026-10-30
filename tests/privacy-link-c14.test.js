/** 设计 C14：PaddleOCR 隐私链接（C14 最终版）https://www.baidu.com/duty/yinsiquan.html，各文档文字一致 */
import fs from 'fs';
import path from 'path';
const URL_ = 'https://www.baidu.com/duty/yinsiquan.html';
const rd = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const ZH = '百度隐私权保护声明（中文）';
const EN = 'Baidu privacy policy (in Chinese)';

test('PRIVACY / README / README_CN 写的是同一个链接和文字', () => {
  expect(rd('PRIVACY.md')).toContain(`[${EN}](${URL_})`);
  expect(rd('README.md')).toContain(`[${EN}](${URL_})`);
  expect(rd('README_CN.md')).toContain(`[${ZH}](${URL_})`);
  for (const f of ['PRIVACY.md', 'README.md', 'README_CN.md']) expect(rd(f)).not.toMatch(/飞桨星河社区隐私政策/);
});

test('PRIVACY.md 保留期一句用句号断开，不是「; The」', () => {
  const p = rd('PRIVACY.md');
  expect(p).toContain('uploaded files or parse results. The applicable policy');
  expect(p).not.toMatch(/; The applicable/);
});
