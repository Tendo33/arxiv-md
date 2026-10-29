/** P3-9：PRIVACY.md 定稿：日期、去掉待审横幅、MinerU 运营方写进正文，保留留存说明 */
import fs from 'fs';
import path from 'path';

const doc = fs.readFileSync(path.join(__dirname, '../PRIVACY.md'), 'utf8');
test('定稿', () => {
  expect(doc).toContain('**Last updated: 2026-10-29**');
  expect(doc).not.toMatch(/Pending review|Update the date above/);
  const mineru = doc.split('#### MinerU')[1];
  expect(mineru.trim().startsWith('MinerU is operated by 上海人工智能创新中心（上海人工智能实验室） (Shanghai Artificial Intelligence Innovation Center / Shanghai AI Laboratory)')).toBe(true);
  expect(mineru).toContain('https://sso.openxlab.org.cn/protocol/privacy');
  expect(doc).toContain('for the period necessary to provide the service');
});
