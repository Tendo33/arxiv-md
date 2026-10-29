// 设计附录 D1（AX-03）：提示在按钮行下方的 #statusZone 里；进度是上下文卡片底边 3px 细条，卡片 flex:none（不是 overflow:hidden）
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const { document } = parseHTML(read('src/ui/popup/popup.html'));
const css = read('src/ui/popup/popup.css');

test('alerts live in #statusZone, after .acts and before #recent', () => {
  const zone = document.getElementById('statusZone');
  expect(zone).not.toBeNull();
  for (const id of ['alertOk', 'alertErr', 'alertKey']) expect(document.getElementById(id).parentElement).toBe(zone);
  const kids = [...document.querySelector('main.body').children];
  const i = (el) => kids.indexOf(el);
  expect(i(zone)).toBeGreaterThan(i(document.querySelector('.acts')));
  expect(i(zone)).toBeLessThan(i(document.getElementById('recent')));
  expect(i(document.getElementById('alertInfo'))).toBeGreaterThan(i(document.querySelector('.acts')));
});
test('status zone collapses when empty; progress is an absolute 3px bar; card flex:none, no overflow:hidden', () => {
  expect(css).toMatch(/\.status-zone:not\(:has\(> :not\(\.hidden\)\)\)\{display:none\}/);
  expect(css).toMatch(/#ctxCard\{position:relative;flex:none\}/);
  expect(css).not.toMatch(/#ctxCard\{[^}]*overflow:hidden/);
  expect(css).toMatch(/#ctxProg\{position:absolute;left:0;right:0;bottom:0/);
  expect(css).toMatch(/#ctxProg \.bar\{height:3px/);
});
test('e2e addendum script is part of npm run test:e2e', () => {
  expect(JSON.parse(read('package.json')).scripts['test:e2e']).toContain('scripts/e2e-popup-addendum.js');
});
