const fs = require('fs');
const path = require('path');
const rd = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const W = '带操作按钮的卡片保留到手动关闭，其他已完成卡片 10 秒后收起';
describe('R5-05（已决定 A）：卡片收起规则写进文档', () => {
  test.each(['README_CN.md', 'docs/ARCHITECTURE.md', 'CHANGELOG.md', 'src/content/progress-ui.js'])('%s', (f) => {
    expect(rd(f)).toContain(W);
  });
  test('README.md 英文同义', () => {
    expect(rd('README.md')).toMatch(/Cards with action buttons stay until you close them; other finished cards hide after 10 seconds/);
  });
});
