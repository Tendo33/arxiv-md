/**
 * design-abs-buttons-2026-10-29 §2.1 / §5.1（B1、R03、R07/R20、R16）：
 * 焦点环统一用 --focus-ring（亮 #2563eb / 暗 #60a5fa，不再是品牌红），只有一圈 2px，不叠 box-shadow；
 * 操作栏回到文档流；header-actions 间距 16px。
 */
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
const rule = (sel) => {
  const i = css.indexOf(`${sel} {`);
  if (i < 0) return null;
  return css.slice(i, css.indexOf('}', i));
};

test('--focus-ring 亮色 #2563eb、暗色 #60a5fa', () => {
  const [light, dark] = [...css.matchAll(/--focus-ring:(#[0-9a-f]{6})/g)].map((m) => m[1]);
  expect([light, dark]).toEqual(['#2563eb', '#60a5fa']);
});

test.each(['.input-field:focus-visible', '.btn-icon:focus-visible', '.btn:focus-visible', '.footer-links a:focus-visible', 'a:focus-visible', '.btn-lang:focus-visible'])(
  '%s：一圈 2px --focus-ring，无 box-shadow 双圈',
  (sel) => {
    const r = rule(sel);
    expect(r).toMatch(/outline: 2px solid var\(--focus-ring\)/);
    expect(r).not.toMatch(/box-shadow: 0 0 0 3px/);
  },
);

test('鼠标点击输入框不再出现红边框 + 3px 阴影', () => {
  const r = rule('.input-field:focus');
  expect(r).toMatch(/outline: none/);
  expect(r).not.toMatch(/var\(--accent/);
});

test('模式卡片：键盘焦点用焦点环，不用品牌红 focus-within', () => {
  expect(css).not.toMatch(/\.mode-card:focus-within/);
  expect(rule('.mode-card:has(input[type="radio"]:focus-visible)')).toMatch(/outline: 2px solid var\(--focus-ring\)/);
});

test('焦点样式里不再引用 --accent-ring', () => {
  const focusRules = [...css.matchAll(/[^{}]*:focus(?:-visible|-within)?[^{}]*\{[^}]*\}/g)].map((m) => m[0]);
  expect(focusRules.filter((r) => /accent-ring/.test(r))).toEqual([]);
});

test('R03：操作栏 static + margin-top 8px；R16：header-actions gap 16px', () => {
  const bar = rule('.actions-bar');
  expect(bar).toMatch(/position: static;/);
  expect(bar).toMatch(/margin-top: 8px;|margin: 8px /);
  expect(bar).not.toMatch(/sticky/);
  expect(rule('.header-actions')).toMatch(/gap: 16px;/);
});
