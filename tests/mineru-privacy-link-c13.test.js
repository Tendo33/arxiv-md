// 附录 C13（设计验收 30a6e1b #8）：MinerU 隐私链接只用 OpenXLab 地址，旧 webpub.shlab.tech 不再出现
import fs from 'fs';
import path from 'path';

const NEW = 'https://sso.openxlab.org.cn/protocol/privacy';
test('old webpub.shlab.tech URL gone from src and PRIVACY.md', () => {
  const root = path.join(__dirname, '..');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = [...walk(path.join(root, 'src')), path.join(root, 'PRIVACY.md')];
  const hits = files.filter((f) => fs.readFileSync(f, 'utf8').includes('webpub.shlab.tech'));
  expect(hits).toEqual([]);
  expect(fs.readFileSync(path.join(root, 'PRIVACY.md'), 'utf8')).toContain(NEW);
});
