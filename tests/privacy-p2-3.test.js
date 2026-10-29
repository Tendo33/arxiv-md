// 审查 P2-3：PRIVACY 按代码写清楚每个后端发送的内容和 OA 规则
import fs from 'fs';
import path from 'path';
const doc = fs.readFileSync(path.join(__dirname, '../PRIVACY.md'), 'utf8');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('MinerU 只发链接；PaddleOCR 仅 arXiv 上传 PDF 文件，其他来源只发链接；PRIVACY 如实写明', () => {
  expect(read('packages/pdf-parse-core/src/providers/mineru.js')).not.toMatch(/FormData|new Blob|arrayBuffer\(\)\s*[,)]/);
  const paddle = read('packages/pdf-parse-core/src/providers/paddleocr.js');
  expect(paddle).toMatch(/new FormData\(\)/);
  expect(paddle).toMatch(/if \(shouldUploadFile\(input\.url\)\)/);
  expect(paddle).toMatch(/fileUrl: input\.url/);
  expect(doc).toMatch(/uploads the PDF file \(up to 50 MB\)/);
  expect(doc).toMatch(/for any other PDF it sends only the PDF link \(`fileUrl`\) and does not upload the file/);
  expect(doc).toMatch(/\*\.bj\.bcebos\.com/);
  expect(doc.match(/does not upload the PDF file/g)).toHaveLength(1); // 只剩 MinerU 段
});

test('写明 OA 规则：arXiv 视为 OA，其余或判断不了先确认', () => {
  expect(doc).toMatch(/\*\*Open access\.\*\* All papers on arXiv are treated as open access/);
  expect(doc).toMatch(/arxiv\.org\/pdf/);
  expect(doc).toMatch(/cannot be determined, nothing is sent/);
  expect(doc).toMatch(/popup, right-click menu, floating button and keyboard shortcut/);
});
