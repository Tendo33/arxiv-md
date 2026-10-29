/** 设计复验 15fe0f9 必须改 2（R22）：.token-status-link 只做纵向点击区扩展，横向 padding/margin 为 0 */
import fs from 'fs';
import path from 'path';
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
test('.token-status-link padding:4px 0; margin:-4px 0', () => {
  const m = css.match(/\.token-status-link\s*\{([^}]*)\}/);
  expect(m[1]).toMatch(/padding:\s*4px 0;/);
  expect(m[1]).toMatch(/margin:\s*-4px 0;/);
});
