// 设计附录 D5（AX-09）：间距回到 4/6/8 网格
import fs from 'fs';
import path from 'path';
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
test('.prov 0 6px；.btn-dl 0 4px；kbd 2px 6px；无 5px 残留', () => {
  const popup = read('src/ui/popup/popup.css');
  const ui = read('src/ui/shared/ui-v2.css');
  expect(popup).toMatch(/\.row \.prov \{[^}]*padding: 0 6px;/);
  expect((popup.match(/\.btn-dl\{padding:0 4px\}/g) || []).length).toBe(2);
  expect(ui).toMatch(/kbd\{[^}]*padding:2px 6px/);
  expect(popup + ui).not.toMatch(/padding:\s*(0 5px|2px 5px)/);
});
