// 审查 P2-3：PRIVACY 按代码写清楚每个后端发送的内容和 OA 规则
import fs from 'fs';
import path from 'path';
const doc = fs.readFileSync(path.join(__dirname, '../PRIVACY.md'), 'utf8');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('两个后端都只发链接，代码里没有上传文件的请求体', () => {
  for (const id of ['paddleocr', 'mineru']) {
    const src = read(`packages/pdf-parse-core/src/providers/${id}.js`);
    expect(src).not.toMatch(/FormData|new Blob|arrayBuffer\(\)\s*[,)]/);
  }
  expect(read('packages/pdf-parse-core/src/providers/paddleocr.js')).toMatch(/fileUrl: input\.url/);
  expect(doc).not.toMatch(/may be uploaded|uploaded instead/);
  expect(doc.match(/does not upload the PDF file/g)).toHaveLength(2);
});

test('写明 OA 规则：arXiv 视为 OA，其余或判断不了先确认', () => {
  expect(doc).toMatch(/\*\*Open access\.\*\* All papers on arXiv are treated as open access/);
  expect(doc).toMatch(/arxiv\.org\/pdf/);
  expect(doc).toMatch(/cannot be determined, nothing is sent/);
  expect(doc).toMatch(/popup, right-click menu, floating button and keyboard shortcut/);
});
