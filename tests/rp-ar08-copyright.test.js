// release-polish AR-08：页脚版权年份不再写死 2025
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { copyrightYears, renderCopyrightYear } from '../src/ui/settings/copyright';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');

test('静态兜底是 2025–2026，且有可更新的 span', () => {
  expect(html).not.toMatch(/© 2025 SimonSun/);
  expect(html).toContain('© <span id="copyrightYears">2025–2026</span> SimonSun');
});

test.each([[2025, '2025'], [2026, '2025–2026'], [2031, '2025–2031']])('%s 年显示 %s', (y, want) => {
  expect(copyrightYears(new Date(y, 5, 1))).toBe(want);
});

test('renderCopyrightYear 按当前年份写回页脚', () => {
  const { document } = parseHTML(html);
  renderCopyrightYear(document, new Date(2027, 0, 1));
  expect(document.querySelector('.footer-copyright').textContent.trim()).toMatch(/^© 2025–2027 SimonSun\./);
});

test('settings.js 初始化时调用', () => {
  const js = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.js'), 'utf8');
  expect(js).toMatch(/renderCopyrightYear\(document\)/);
});
