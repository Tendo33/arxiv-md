// 设计附录 D4（AX-08）：.token-status-link 扩大点击区 + 焦点环；#getKeyLink 不受影响
import fs from 'fs';
import path from 'path';
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
const rule = (sel) => (css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.:#-]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`)) || [])[1] || '';
test('点击区：inline-block + padding 4px 2px + 负 margin + 圆角 4px', () => {
  const r = rule('.token-status-link');
  for (const d of ['display: inline-block', 'padding: 4px 2px', 'margin: -4px -2px', 'border-radius: 4px']) expect(r).toContain(d);
});
test('focus-visible：2px --focus-ring', () => {
  expect(rule('.token-status-link:focus-visible')).toContain('outline: 2px solid var(--focus-ring)');
  expect(css).toMatch(/--focus-ring:\s*#2563eb/);
  expect(css).toMatch(/--focus-ring:\s*#60a5fa/);
});
test('#getKeyLink 不套用', () => {
  expect(css).not.toMatch(/#getKeyLink[^{]*\{[^}]*margin: -4px -2px/);
  const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
  expect(html).not.toMatch(/id="getKeyLink"[^>]*token-status-link/);
});
