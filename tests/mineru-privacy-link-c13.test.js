// 附录 C13（设计验收 30a6e1b #8）：MinerU 隐私链接只用 OpenXLab 地址，旧 webpub.shlab.tech 不再出现
import fs from 'fs';
import path from 'path';
import { PRIVACY_LINKS } from '../src/ui/settings/disclosure';
import { translations } from '../src/config/locales';

const NEW = 'https://sso.openxlab.org.cn/protocol/privacy';
test('MinerU privacy link is the OpenXLab URL', () => { expect(PRIVACY_LINKS.mineru).toBe(NEW); });
test('link text', () => {
  expect(translations.zh.pdf_disc_link_mineru).toBe('MinerU 个人信息保护政策（OpenXLab，中文）');
  expect(translations.en.pdf_disc_link_mineru).toBe('MinerU privacy policy (OpenXLab, in Chinese)');
});
test('old webpub.shlab.tech URL gone from src and PRIVACY.md', () => {
  const root = path.join(__dirname, '..');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = [...walk(path.join(root, 'src')), path.join(root, 'PRIVACY.md')];
  const hits = files.filter((f) => fs.readFileSync(f, 'utf8').includes('webpub.shlab.tech'));
  expect(hits).toEqual([]);
  expect(fs.readFileSync(path.join(root, 'PRIVACY.md'), 'utf8')).toContain(NEW);
});
