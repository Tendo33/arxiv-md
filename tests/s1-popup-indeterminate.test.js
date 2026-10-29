// 设计建议 S-1：popup 转换中进度条不再写死 40%，改为与页面进度卡同款不确定动画
import fs from 'fs';
import path from 'path';
const read = (f) => fs.readFileSync(path.join(__dirname, '../src/ui/popup', f), 'utf8');

test('setBusy 不写死 40%，切换 indeterminate', () => {
  const js = read('popup.js');
  const body = js.slice(js.indexOf('function setBusy'), js.indexOf('function hideAlerts'));
  expect(body).not.toMatch(/40%/);
  expect(body).toMatch(/classList\.toggle\('indeterminate', on\)/);
});
test('progressbar 不设 aria-valuenow（不确定态）', () => {
  expect(read('popup.html')).toMatch(/class="bar" role="progressbar"(?![^>]*aria-valuenow)/);
});
test('动画 30% / 1.2s，减少动态时静止 30%', () => {
  const css = read('popup.css');
  expect(css).toMatch(/#ctxProg \.bar\.indeterminate>i\{width:30%;animation:amd-indet 1\.2s[^}]*infinite\}/);
  expect(css).toMatch(/prefers-reduced-motion:reduce\)\{#ctxProg \.bar\.indeterminate>i\{animation:none!important;transform:none;width:30%\}/);
});
