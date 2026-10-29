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

describe('审查 P3①：转义的 \\$ 不算公式定界符', () => {
  test('\\$x <b>y</b> \\$：两个都转义 → 不保护，标签照常清理', () => {
    expect(strip('价格 \\$x <b>y</b> \\$ 元')).toBe('价格 \\$x y \\$ 元');
  });
  test('开头转义、结尾不转义 → 不算公式', () => {
    expect(strip('a \\$x <b>y</b>$ b')).toBe('a \\$x y$ b');
  });
  test('开头正常、结尾转义 → 结尾不算，继续找下一个可用结尾', () => {
    expect(strip('a $x <b>y</b>\\$ b')).toBe('a $x y\\$ b');
    expect(strip('a $x\\$<b>y</b>$ b')).toBe('a $x\\$<b>y</b>$ b');
  });
  test('\\\\$：转义的是反斜杠，$ 仍是定界符', () => {
    expect(strip('a \\\\$x<b>y</b>$ b')).toBe('a \\\\$x<b>y</b>$ b');
  });
});

describe('batch9 ③：围栏和同一行 $$ 的扫描是线性的', () => {
  const time = (fn) => { const t0 = Date.now(); fn(); return Date.now() - t0; };
  test('2 万个未闭合围栏 < 1s（原来约 4.9s）', () => {
    const s = Array.from({ length: 20000 }, (_, k) => '`'.repeat(3 + (k % 3)) + 'py\nx <b>y</b>').join('\n');
    let out;
    expect(time(() => { out = strip(s); })).toBeLessThan(1000);
    expect(out).not.toContain('<b>');
  });
  test('长度各不相同的未闭合围栏 < 1s', () => {
    const s = Array.from({ length: 400 }, (_, k) => '~'.repeat(3 + k) + '\n<b>z</b>').join('\n');
    expect(time(() => strip(s))).toBeLessThan(1000);
  });
  test('同一行 5000 个 $$a$$ < 1s（原来约 3.1s），都受保护', () => {
    const s = '$$a<b>$$ '.repeat(5000);
    let out;
    expect(time(() => { out = strip(s); })).toBeLessThan(1000);
    expect(out).toBe(s);
  });
  test('大量未闭合 $$ < 1s', () => {
    const s = '$$ <b>x</b> '.repeat(1) + 'a\n'.repeat(1) + ('$x$ <b>y</b> ').repeat(20000);
    expect(time(() => strip(s))).toBeLessThan(1000);
  });
  test('语义不变：只有同一个串独占一行才闭合；更长或带字符的行不算', () => {
    expect(strip('```\n<b>a</b>\n````\n<b>b</b>\n```  \n<b>c</b>')).toBe('```\n<b>a</b>\n````\n<b>b</b>\n```  \nc');
    expect(strip('~~~~\n<b>a</b>\n~~~x\n~~~~\n<b>c</b>')).toBe('~~~~\n<b>a</b>\n~~~x\n~~~~\nc');
    expect(strip('```\n<b>a</b>')).toBe('```\na');
    expect(strip('前 <b>x</b>\n```\n```\n```\n<b>y</b>')).toBe('前 x\n```\n```\n```\ny');
  });
  test('同一行 $$ 之后的 $…$ 和行内代码照常判定', () => {
    expect(strip('$$a$$ <b>x</b> $c<b>d$ `<b>` <b>e</b>')).toBe('$$a$$ x $c<b>d$ `<b>` e');
    expect(strip('$$a\n<b>b</b>$$ <b>c</b> $d<b>$')).toBe('$$a\n<b>b</b>$$ c $d<b>$');
  });
});
