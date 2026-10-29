/** P3-8：README_CN 与 README 一致：PaddleOCR 结果是 MinerU 结构的 ZIP（full.md + images/） */
import fs from 'fs';
import path from 'path';

const cn = fs.readFileSync(path.join(__dirname, '../README_CN.md'), 'utf8');
const en = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
test('ZIP 说法一致', () => {
  expect(en).toContain('ZIP laid out like MinerU\'s (`full.md` + `images/`)');
  expect(cn).toContain('PaddleOCR 结果保存为与 MinerU 同样结构的 ZIP 包（`full.md` + `images/`）');
  expect(cn).not.toContain('带图片时为 ZIP 包');
});
