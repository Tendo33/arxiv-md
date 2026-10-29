// rp2c 建议项：任务列表底部留 8px，滚到底时最后一行失败原因不被列表底边截半行（e2e-popup-a11y 实测间距）
import fs from 'fs';
import path from 'path';
test('#taskList padding-bottom:8px', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
  expect(css).toMatch(/#taskList\{padding-bottom:8px\}/);
});
