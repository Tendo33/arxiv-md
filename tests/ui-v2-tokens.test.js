// Round 3 C-1：共用 ui-v2.css 与 zhihu-md 字节相同；tokens 在浅/深色下实测对比度（color-mix 正确解析）
const fs = require('fs');
const path = require('path');
const { parseTokens, resolve, over, ratio } = require('./helpers/contrast');

const css = fs.readFileSync(path.join(__dirname, '../src/ui/shared/ui-v2.css'), 'utf8');
const L = parseTokens(css.slice(0, css.indexOf('@media')), (s) => s === ':root');
const D = { ...L, ...parseTokens(css.slice(0, css.indexOf('@media')), (s) => s === '[data-theme=dark]') };
const pair = (v, fg, bg) => ratio(over(resolve(fg, v), resolve(bg, v)), resolve(bg, v));

test.each([['light', L], ['dark', D]])('%s：正文/次要/品牌/状态色对比度达标', (_n, v) => {
  for (const bg of ['var(--bg)', 'var(--surface)']) {
    expect(pair(v, 'var(--text)', bg)).toBeGreaterThanOrEqual(4.5);
    expect(pair(v, 'var(--text-2)', bg)).toBeGreaterThanOrEqual(4.5);
  }
  expect(pair(v, 'var(--brand-on)', 'var(--brand)')).toBeGreaterThanOrEqual(4.5);
  expect(pair(v, 'var(--danger)', 'var(--danger-bg)')).toBeGreaterThanOrEqual(4.5);
  expect(pair(v, 'var(--success)', 'var(--success-bg)')).toBeGreaterThanOrEqual(4.5);
  expect(pair(v, 'var(--border-strong)', 'var(--surface)')).toBeGreaterThan(1.3);
});

test('color-mix 解析：50/50 白黑、透明预乘', () => {
  const g = resolve('color-mix(in srgb, #fff, #000)', {});
  expect(g.slice(0, 3).map(Math.round)).toEqual([128, 128, 128]);
  const t = resolve('color-mix(in srgb, #ff0000 50%, transparent)', {});
  expect(t.slice(0, 3)).toEqual([255, 0, 0]);
  expect(t[3]).toBeCloseTo(0.5);
});

test('与 zhihu-md 的 lib/ui-v2.css 内容一致（生成器同源）', () => {
  expect(css.startsWith('/* ui-v2.css — Round 3 C-1')).toBe(true);
  expect(css).toMatch(/\[data-brand=zhihu\]/);
  expect(css).toMatch(/prefers-color-scheme:dark/);
});
