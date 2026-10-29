/** 审查 P3-d：上传上限按十进制 50 MB = 50,000,000 字节，和文案「50 MB」一致；文档写明字节数 */
import fs from 'fs';
import path from 'path';
import { PADDLEOCR_MAX_UPLOAD_BYTES } from '@pdf-core/providers/paddleocr';
const rd = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('PADDLEOCR_MAX_UPLOAD_BYTES === 50,000,000', () => {
  expect(PADDLEOCR_MAX_UPLOAD_BYTES).toBe(50_000_000);
});
test('PRIVACY / ARCHITECTURE 写明字节数，不出现 MiB', () => {
  expect(rd('PRIVACY.md')).toMatch(/up to 50 MB, i\.e\. 50,000,000 bytes/);
  expect(rd('docs/ARCHITECTURE.md')).toMatch(/≤50 MB，即 50,000,000 字节/);
  for (const f of ['PRIVACY.md', 'README.md', 'README_CN.md', 'docs/ARCHITECTURE.md', 'src/config/locales.js']) expect(rd(f)).not.toMatch(/MiB/);
});
