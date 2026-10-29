// 设计复验 15fe0f9「建议」项
import fs from 'fs';
import path from 'path';
import { NW_ZH } from '../src/ui/settings/nw-segments.js';
import { translations } from '../src/config/locales.js';

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('C11：pdf_desc 的空格单列在 span 外，没有片段首尾带空格', () => {
  expect(NW_ZH.pdf_desc.join('')).toBe(translations.zh.pdf_desc);
  for (const s of NW_ZH.pdf_desc) if (!/^\s+$/.test(s)) expect(s).toBe(s.trim());
});
test('pdf-provider.js 注释不再写旧按钮名「同意并使用」', () => {
  expect(read('src/ui/settings/pdf-provider.js')).not.toMatch(/同意并使用/);
});
