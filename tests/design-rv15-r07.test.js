/** 设计复验 15fe0f9 必须改 1（R07）：.btn-primary 聚焦时不能有 box-shadow 过渡（否则 Tab 后 ~300ms 闪品牌红） */
import fs from 'fs';
import path from 'path';
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
test('.btn-primary:focus-visible 同时 box-shadow:none 与 transition:none', () => {
  const m = css.match(/\.btn-primary:focus-visible\s*\{([^}]*)\}/);
  expect(m).toBeTruthy();
  expect(m[1]).toMatch(/box-shadow:\s*none/);
  expect(m[1]).toMatch(/transition:\s*none/);
});
