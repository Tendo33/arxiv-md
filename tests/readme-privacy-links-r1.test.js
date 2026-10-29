// QA 6a49976 R-1：README / README_CN / PRIVACY 三处都列出两个链接，AI Studio 写明适用范围、仅作参考
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const BAIDU = 'https://www.baidu.com/duty/yinsiquan.html';
const AIS = 'https://aistudio.baidu.com/privacy';

describe('R-1 privacy links parity', () => {
  test.each(['README.md', 'README_CN.md', 'PRIVACY.md'])('%s lists both links', (f) => {
    const s = read(f);
    expect(s).toContain(BAIDU);
    expect(s).toContain(AIS);
  });
  test('README.md: Baidu is the applicable policy, AI Studio is reference with scope', () => {
    const s = read('README.md');
    expect(s).toMatch(/applicable policy is the \[Baidu privacy policy/);
    expect(s).toMatch(/For reference only, the \[PaddlePaddle AI Studio privacy policy/);
    expect(s).toMatch(/excluding PC/);
    expect(s.indexOf(BAIDU)).toBeLessThan(s.indexOf(AIS));
  });
  test('README_CN.md: scope and reference-only', () => {
    const s = read('README_CN.md');
    expect(s).toMatch(/适用的政策是\[百度隐私权保护声明/);
    expect(s).toMatch(/不含PC端/);
    expect(s).toMatch(/仅作参考/);
  });
});
