/**
 * batch8 ②（batch7 审查 P3-2）：replaceOutsideProtected 改为单遍扫描。
 * - $…$：开头 $ 后不是空白，结尾 $ 前不是空白、后不是数字（Pandoc 规则）；货币 $5 … $10 不算公式。
 * - 行内代码：CommonMark 的等长反引号串配对（支持 ``a`b``）；5 万个反引号 < 100ms。
 */
import { replaceOutsideProtected } from '../src/content/markdown-postprocess';

const strip = (s) => replaceOutsideProtected(s, (t) => t.replace(/<\/?b>/g, ''));

describe('batch8 $ 判定', () => {
  test('货币 $5 <b>x</b> 到 $10：中间残留标签照常清理', () => {
    expect(strip('价格 $5 <b>x</b> 到 $10')).toBe('价格 $5 x 到 $10');
  });
  test('开头 $ 后是空白 / 结尾 $ 前是空白：不当公式', () => {
    expect(strip('a $ <b>x</b>$ b')).toBe('a $ x$ b');
    expect(strip('a $x <b>y</b> $ b')).toBe('a $x y $ b');
  });
  test('真公式仍保护', () => {
    expect(strip('式 $a<b>c$ 与 $$<b>$$ 结束 <b>')).toBe('式 $a<b>c$ 与 $$<b>$$ 结束 ');
  });
  test('$5,$10 紧挨的货币：结尾 $ 后是数字，不当公式', () => {
    expect(strip('从 $5,<b>x</b>$10 起')).toBe('从 $5,x$10 起');
  });
  test('以数字开头的真公式 $0$ / $0.25$ 仍保护', () => {
    expect(strip('Temp $0$ <b>与</b> $0.25<b>$')).toBe('Temp $0$ 与 $0.25<b>$');
  });
  test('$x$ 之后的货币不受影响', () => {
    expect(strip('$x$ 花了 $5 <b>多</b>')).toBe('$x$ 花了 $5 多');
  });
});

describe('batch8 行内代码 / 围栏', () => {
  test.each([
    ['单反引号', '`<b>` <b>', '`<b>` '],
    ['双反引号含单反引号', '``a`<b>`b`` <b>', '``a`<b>`b`` '],
    ['长度不等不配对', '``<b>` <b>', '``` '],
    ['跨行不配对', '`<b>\n<b>`', '`\n`'],
    ['围栏块', '```py\n<b>\n```\n<b>', '```py\n<b>\n```\n'],
    ['未闭合围栏不保护', '```\n<b>', '```\n'],
  ])('%s', (_n, input, want) => {
    expect(strip(input)).toBe(want);
  });
});

describe('batch8 性能', () => {
  test.each([
    ['5 万个连续反引号', '`'.repeat(50000)],
    ['5 万个反引号 + 标签', '`'.repeat(50000) + '<b>x</b>'],
    ['交替长度反引号串', Array.from({ length: 316 }, (_, k) => '`'.repeat(k + 1) + 'x').join('')],
    ['5 万个反引号后换行', '`'.repeat(50000) + '\n<b>x</b>'],
    ['5 万个 ` a', '` a'.repeat(50000)],
    ['5 万个 $a 无结尾', ' $a'.repeat(50000)],
  ])('%s < 100ms', (_n, input) => {
    strip(input); // 预热
    const t0 = process.hrtime.bigint();
    strip(input);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    // eslint-disable-next-line no-console
    console.log(`batch8 perf ${_n}: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(100);
  });
});
