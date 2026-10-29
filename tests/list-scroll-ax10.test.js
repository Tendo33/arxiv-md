// 设计附录 D6（AX-10）：列表停在被截行一半 + can-scroll/at-end + tabindex
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { fitListToHalfRow, updateListScrollState } from '../src/ui/popup/list-scroll';

const def = (o, k, get) => Object.defineProperty(o, k, { configurable: true, get });
function setup(rowH, n, avail) {
  const { document } = parseHTML('<html><body><div id="taskList"></div></body></html>');
  const list = document.getElementById('taskList');
  for (let i = 0; i < n; i++) {
    const r = document.createElement('div');
    def(r, 'offsetTop', () => 4 + i * rowH); def(r, 'offsetHeight', () => rowH);
    list.appendChild(r);
  }
  let top = 0;
  def(list, 'scrollHeight', () => 4 + n * rowH + 8);
  def(list, 'clientHeight', () => { const m = parseFloat(list.style.maxHeight); return Number.isFinite(m) ? Math.min(m, avail) : avail; });
  Object.defineProperty(list, 'scrollTop', { configurable: true, get: () => top, set: (v) => { top = v; } });
  return list;
}

test('溢出：max-height = 中线在可用高度内的最后一行 offsetTop + 高度/2（必须改 6），能滚未到底，可聚焦', () => {
  const list = setup(46, 6, 150); // 第 4 行中线 165 > 150；第 3 行中线 119 ≤ 150 → 停在第 3 行一半
  const s = fitListToHalfRow(list);
  expect(list.style.maxHeight).toBe(`${96 + 23}px`);
  expect(list.style.minHeight).toBe(`${96 + 23}px`); // Q1：2.5 行下限
  expect(s).toEqual({ can: true, atEnd: false });
  expect(list.classList.contains('can-scroll')).toBe(true);
  expect(list.getAttribute('tabindex')).toBe('0');
  list.scrollTop = 1000;
  updateListScrollState(list);
  expect(list.classList.contains('at-end')).toBe(true);
});

test('不溢出：不设 max-height、不可聚焦、无渐隐', () => {
  const list = setup(46, 2, 150);
  expect(fitListToHalfRow(list)).toEqual({ can: false, atEnd: true });
  expect(list.style.maxHeight).toBe('');
  expect(list.hasAttribute('tabindex')).toBe(false);
  expect(list.classList.contains('can-scroll')).toBe(false);
});

test('CSS：sticky 渐隐到 --surface、无 mask-image、焦点环、减弱动效', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
  expect(css).toMatch(/#taskList\.can-scroll:not\(\.at-end\)::after\{[^}]*position:sticky[^}]*height:24px[^}]*var\(--surface\)/);
  expect(css).not.toMatch(/#taskList[^{]*\{[^}]*mask-image/);
  expect(css).toMatch(/#taskList:focus-visible\{outline:2px solid var\(--focus\);outline-offset:2px\}/);
  expect(css).toMatch(/prefers-reduced-motion:reduce\)\{#taskList\{scroll-behavior:auto\}/);
});

test('popup 渲染后调用 fitListToHalfRow 并绑定滚动', () => {
  const js = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.js'), 'utf8');
  expect(js).toMatch(/fitListToHalfRow\(\$\('taskList'\)\)/);
  expect(js).toMatch(/bindListScroll\(\$\('taskList'\), window\)/);
});
