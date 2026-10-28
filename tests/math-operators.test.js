import katex from 'katex';
import { cleanLatexFormula } from '../src/content/ar5iv-math';

const render = (tex) => katex.renderToString(tex, { throwOnError: true, displayMode: true });

describe('自定义算子宏映射', () => {
  test('argmax/argmin 用 \\operatorname*（下标在正下方）', () => {
    expect(cleanLatexFormula('\\argmax_{\\theta} f')).toContain('\\operatorname*{argmax}_{\\theta}');
    expect(cleanLatexFormula('\\argmin\\limits_x g')).toContain('\\operatorname*{argmin}');
    expect(() => render(cleanLatexFormula('\\argmax_{\\theta} f'))).not.toThrow();
  });
  test('diag/tr 等仍是 \\operatorname；已有写法不动', () => {
    expect(cleanLatexFormula('\\diag(x)')).toContain('\\operatorname{diag}(x)');
    expect(cleanLatexFormula('\\operatorname*{argmax}_x')).toContain('\\operatorname*{argmax}_x');
    expect(cleanLatexFormula('\\triangle \\trace')).not.toContain('operatorname');
  });
  test('\\text{\\diag} 换成纯文字，KaTeX 可渲染', () => {
    const out = cleanLatexFormula('\\text{\\diag} A');
    expect(out).toContain('\\text{diag}');
    expect(() => render(out)).not.toThrow();
  });
  test('\\\\diag（换行后紧跟字母）不被替换；\\\\\\diag 仍替换', () => {
    expect(cleanLatexFormula('a \\\\diag b')).not.toContain('operatorname');
    expect(cleanLatexFormula('a \\\\\\diag b')).toContain('\\\\\\operatorname{diag}');
  });
});
