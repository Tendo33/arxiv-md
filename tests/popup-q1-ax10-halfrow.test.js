// 设计复验 15fe0f9：Q1（有提示卡时列表 ≥2.5 行）+ 必须改 6（AX-10 半行 + 状态区变化重算）
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { fitListToHalfRow, refitOnResize } from '../src/ui/popup/list-scroll';

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const def = (o, k, get) => Object.defineProperty(o, k, { configurable: true, get });
function setup(rowH, n, avail) {
  const { document } = parseHTML('<div id="l"></div>');
  const list = document.getElementById('l');
  for (let i = 0; i < n; i++) { const r = document.createElement('div'); def(r, 'offsetTop', () => 4 + i * rowH); def(r, 'offsetHeight', () => rowH); list.appendChild(r); }
  def(list, 'scrollHeight', () => 12 + n * rowH);
  def(list, 'clientHeight', () => { const mn = parseFloat(list.style.minHeight) || 0; const mx = parseFloat(list.style.maxHeight); return Math.max(mn, Number.isFinite(mx) ? Math.min(mx, avail) : avail); });
  return list;
}

test('nohint 展开：可用 150、行高 46 → 正好露 0.5 行（不是 0.25 行）', () => {
  const list = setup(46, 12, 150);
  fitListToHalfRow(list);
  const mh = parseFloat(list.style.maxHeight);
  expect((mh - 4 - 2 * 46) / 46).toBe(0.5);
});

test('320 行高 59、提示卡把可用压到 60：下限保证 2 整行 + 0.5 行', () => {
  const list = setup(59, 5, 60);
  fitListToHalfRow(list);
  expect(parseFloat(list.style.minHeight)).toBe(Math.round(4 + 2 * 59 + 59 / 2));
  expect(parseFloat(list.style.maxHeight)).toBe(Math.round(4 + 2 * 59 + 59 / 2));
});

test('状态区尺寸变化触发重算', () => {
  let cb = null; const seen = [];
  class RO { constructor(f) { cb = f; } observe(el) { seen.push(el); } }
  const list = setup(46, 12, 300);
  const zone = {};
  refitOnResize(zone, list, { ResizeObserver: RO });
  expect(seen).toEqual([zone]);
  list.style.maxHeight = '1px';
  cb();
  expect(list.style.maxHeight).not.toBe('1px');
});

test('popup 接线 + Q1 CSS', () => {
  expect(read('src/ui/popup/popup.js')).toMatch(/refitOnResize\(\$\('statusZone'\), \$\('taskList'\), window\)/);
  const css = read('src/ui/popup/popup.css');
  expect(css).toMatch(/#alertKey\{padding:8px 10px\}/);
  expect(css).toMatch(/#alertKey #keySettingsBtn\{grid-column:2;grid-row:1\/span 2/);
  expect(css).toMatch(/\.pop:has\(#alertKey:not\(\.hidden\)\)\{max-height:600px\}/);
  expect(css).toMatch(/\.body\{overflow-y:auto\}/);
});

// 审查 P3-2：max-height 不能小于 min-height；2/3/4 行与「中线正好等于可用高度」的边界
describe('P3-2 边界', () => {
  // 模拟浏览器里 clientHeight 比 offsetTop 参照少 2px（边框）的情况
  function setupBorder(rowH, n, avail) {
    const list = setup(rowH, n, avail);
    def(list, 'clientHeight', () => { const mn = parseFloat(list.style.minHeight) || 0; const mx = parseFloat(list.style.maxHeight); return Math.max(mn, Number.isFinite(mx) ? Math.min(mx, avail) : avail) - 2; });
    return list;
  }
  const px = (v) => parseFloat(v);
  test.each([3, 4, 12])('%i 行、可用高度很小 + 2px 边框差：max-height ≥ min-height，且停在第 3 行中线', (n) => {
    const list = setupBorder(46, n, 60);
    fitListToHalfRow(list);
    expect(px(list.style.minHeight)).toBe(Math.round(4 + 2 * 46 + 23));
    expect(px(list.style.maxHeight)).toBeGreaterThanOrEqual(px(list.style.minHeight));
    expect(px(list.style.maxHeight)).toBe(Math.round(4 + 2 * 46 + 23));
  });
  test('2 行：不设 min-height（不足 3 行没有下限）', () => {
    const list = setup(46, 2, 60);
    fitListToHalfRow(list);
    expect(list.style.minHeight).toBe('');
    expect(px(list.style.maxHeight)).toBe(Math.round(4 + 23));
  });
  test('正好 3 行就设下限（>= 3，不是 >= 4）', () => {
    const list = setup(46, 3, 300);
    fitListToHalfRow(list);
    expect(px(list.style.minHeight)).toBe(Math.round(4 + 2 * 46 + 23));
  });
  test('中线正好等于可用高度：这一行算作被截行（<=，不是 <）', () => {
    const avail = 4 + 3 * 46 + 23; // 第 4 行中线
    const list = setup(46, 12, avail);
    fitListToHalfRow(list);
    expect(px(list.style.maxHeight)).toBe(avail);
  });
  test('2 行、中线正好等于可用高度（无下限路径的 <=）', () => {
    const list = setup(46, 3 - 1, 4 + 46 + 23);
    def(list, 'scrollHeight', () => 400);
    fitListToHalfRow(list);
    expect(px(list.style.maxHeight)).toBe(4 + 46 + 23);
  });
});
