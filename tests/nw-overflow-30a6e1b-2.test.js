// 设计验收 30a6e1b #2：面板正文走手工表；自动切分片段 >12 字不加 .nw
const { translations } = require('../src/config/locales');
const { NW_ZH, NW_MAX, nwNodes } = require('../src/ui/settings/nw-segments');
const { parseHTML } = require('linkedom');
const { document } = parseHTML('<p></p>');
test('disclosure bodies use manual tables (all .nw spans from the table)', () => {
  for (const k of ['pdf_disc_body_paddleocr', 'pdf_disc_body_mineru']) {
    const spans = nwNodes(document, k, translations.zh[k], 'zh').filter((n) => n.nodeType === 1);
    expect(spans.map((s) => s.textContent)).toEqual(NW_ZH[k].filter((s) => s.trim()));
  }
});
test('fallback: segment longer than NW_MAX gets no .nw', () => {
  expect(NW_MAX).toBe(12);
  const long = '这是一段超过十二个字而且中间没有任何标点的长句子，短句。';
  const nodes = nwNodes(document, 'no_table', long, 'zh');
  expect(nodes[0].nodeType).toBe(3);
  expect(nodes[1].nodeType).toBe(1);
  expect(nodes.map((n) => n.textContent).join('')).toBe(long);
  for (const n of nodes) if (n.nodeType === 1) expect(n.textContent.trim().length).toBeLessThanOrEqual(NW_MAX);
});
test('permission line (fallback) never yields a .nw longer than NW_MAX', () => {
  const t = translations.zh.pdf_perm_missing.replace('{host}', 'aistudio.baidu.com').replace('{provider}', 'PaddleOCR');
  const nodes = nwNodes(document, 'pdf_perm', t, 'zh');
  expect(nodes.map((n) => n.textContent).join('')).toBe(t);
  for (const n of nodes) if (n.nodeType === 1) expect(n.textContent.trim().length).toBeLessThanOrEqual(NW_MAX);
});
