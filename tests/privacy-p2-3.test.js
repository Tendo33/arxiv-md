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

describe('路线 2：界面 / README / ARCHITECTURE 与实际行为一致（arXiv PDF 文件本身发往 PaddleOCR）', () => {
  const { translations } = require('../src/config/locales');
  const rd = (f) => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8');
  test.each(['zh', 'en'])('%s 设置页 PaddleOCR 说明写明发 PDF 文件（≤50 MB）、非 arXiv 只发链接', (l) => {
    const d = translations[l].pdf_desc_paddleocr;
    expect(d).toMatch(/50 MB/);
    expect(d).toMatch(l === 'zh' ? /PDF 文件本身[\s\S]*只发链接/ : /PDF file itself[\s\S]*only the link/);
  });
  test('README / ARCHITECTURE 提到 bcebos 与 ZIP 结构', () => {
    expect(rd('README.md')).toMatch(/\*\.bj\.bcebos\.com/);
    expect(rd('README.md')).toMatch(/full\.md/);
    expect(rd('docs/ARCHITECTURE.md')).toMatch(/\*\.bj\.bcebos\.com/);
    expect(rd('docs/ARCHITECTURE.md')).toMatch(/≤50 MB/);
  });
});

describe('隐私说明（Simon：arXiv 论文都算 OA，直接解析）和实际发送内容一致', () => {
  const rd = (f) => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8');
  test('PRIVACY.md：arXiv PDF → PaddleOCR 收文件（≤50 MB）、MinerU 只收链接；其他 PDF 只发链接；bcebos 在权限表里', () => {
    const p = rd('PRIVACY.md');
    expect(p).not.toMatch(/Neither provider receives the PDF file/);
    expect(p).toMatch(/PDF hosted on arXiv[^\n]*PaddleOCR receives the PDF file itself[^\n]*50 MB[^\n]*MinerU receives only the PDF link/);
    expect(p).toMatch(/Any other PDF\*\*: both providers receive only the PDF link/);
    expect(p).toMatch(/\| `https:\/\/\*\.bj\.bcebos\.com\/\*` \(optional\) \|/);
    expect(p).not.toMatch(/pending QA/);
    expect(p.match(/Access to (both domains|this domain) is requested/g)).toHaveLength(1);
  });
  test('README_CN 隐私段同一说法', () => {
    expect(rd('README_CN.md')).toMatch(/MinerU 收到 arXiv PDF 链接；PaddleOCR 收到 arXiv PDF 文件本身（上传，50 MB 以内），非 arXiv 的 PDF 只发链接/);
  });
  test('代码事实：MinerU submit 只发 url；PaddleOCR 只对 arXiv 主机上传', () => {
    const m = rd('packages/pdf-parse-core/src/providers/mineru.js');
    expect(m).toMatch(/url: input\.url/);
    expect(m).not.toMatch(/FormData/);
    const { shouldUploadFile } = require('@pdf-core/providers/paddleocr');
    expect(shouldUploadFile('https://arxiv.org/pdf/1706.03762')).toBe(true);
    expect(shouldUploadFile('https://example.org/a.pdf')).toBe(false);
  });
});
