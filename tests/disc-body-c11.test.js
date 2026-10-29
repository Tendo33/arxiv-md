// 设计 C11 #2/#3：两家面板正文最终稿 + zh .nw 分段
const { translations } = require('../src/config/locales');
const { NW_ZH, nwNodes } = require('../src/ui/settings/nw-segments');
const { parseHTML } = require('linkedom');
const C11 = {
  pdf_disc_body_paddleocr: {
    zh: '使用 PaddleOCR 时，来自 arXiv 的 PDF 文件（50 MB 以内）会连同你的访问令牌和解析选项上传到百度飞桨星河社区；更大的 PDF 不会发送。其他网站的 PDF 只发送链接，并且每次都要你确认。',
    en: 'With PaddleOCR, PDFs from arXiv (up to 50 MB) are uploaded to Baidu AI Studio together with your access token and parsing options. Larger PDFs are not sent. For PDFs from other sites, only the link is sent, and only after you confirm each time.',
  },
  pdf_disc_body_mineru: {
    zh: '使用 MinerU 时，论文的 PDF 链接（另加 arXiv ID）会连同你的 API Key 和解析选项发给 MinerU（mineru.net），由它下载并解析；PDF 文件本身不会上传。其他网站的 PDF 每次都要你确认后才发送。',
    en: "With MinerU, the PDF's link (plus the arXiv ID) is sent to MinerU (mineru.net) together with your API key and parsing options; MinerU downloads and parses the paper itself. The PDF file is not uploaded. For PDFs from other sites, the link is sent only after you confirm each time.",
  },
};
test.each(Object.keys(C11))('%s zh/en verbatim + nw table joins exactly', (k) => {
  expect(translations.zh[k]).toBe(C11[k].zh);
  expect(translations.en[k]).toBe(C11[k].en);
  expect(NW_ZH[k].join('')).toBe(C11[k].zh);
  expect(NW_ZH[k].filter((s) => s.trim())).toHaveLength(10);
  const { document } = parseHTML('<p></p>');
  const nodes = nwNodes(document, k, C11[k].zh, 'zh');
  expect(nodes.map((n) => n.textContent)).toEqual(NW_ZH[k]);
  // 空格不在 span 里
  for (const n of nodes) if (n.nodeType === 1) expect(n.textContent).toBe(n.textContent.trim());
  expect(nodes.filter((n) => n.nodeType === 3).map((n) => n.textContent)).toEqual(k === 'pdf_disc_body_mineru' ? [' ', ' '] : [' ']);
});
