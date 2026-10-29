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
