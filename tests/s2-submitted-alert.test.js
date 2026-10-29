// 设计建议 S-2：popup「已提交」提示用时钟图标 + 信息色，普通「已保存」仍是绿色 ✓
import fs from 'fs';
import path from 'path';
const read = (f) => fs.readFileSync(path.join(__dirname, '../src/ui/popup', f), 'utf8');

test('popup.html 有时钟图标，默认隐藏', () => {
  const html = read('popup.html');
  expect(html).toMatch(/id="okIconPending" class="hidden"[^>]*>.*<circle/);
  expect(html).toMatch(/id="okIconDone"/);
});
test('showOk(submitted) 切换 pending 类和图标', () => {
  const js = read('popup.js');
  const body = js.slice(js.indexOf('function showOk'), js.indexOf('function showNeedKey'));
  expect(body).toMatch(/state === 'submitted'/);
  expect(body).toMatch(/classList\.toggle\('pending', pending\)/);
  expect(body).toMatch(/okIconPending'\)\.classList\.toggle\('hidden', !pending\)/);
});
test('pending 用 info 色而不是 success', () => {
  expect(read('popup.css')).toMatch(/\.alert\.ok\.pending\{background:var\(--info-bg\);color:var\(--info\)\}/);
});
