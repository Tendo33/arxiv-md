const fs = require('fs');
test('README privacy line no longer claims nothing is uploaded', () => {
  const cn = fs.readFileSync('README_CN.md', 'utf8');
  const en = fs.readFileSync('README.md', 'utf8');
  expect(cn).not.toMatch(/不收集、不上传你的数据/);
  expect(cn).toMatch(/PaddleOCR 会上传 arXiv 上 50MB 以内的 PDF 文件/);
  expect(en).not.toMatch(/^- No backend, no analytics, no data collection\.$/m);
  expect(en).toMatch(/PaddleOCR uploads arXiv PDFs up to 50 MB as files/);
});
