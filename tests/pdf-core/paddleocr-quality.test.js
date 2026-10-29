// PaddleOCR 输出质量对齐 MinerU（fix/paddleocr-quality）：用 2026-10-29 真实 JSONL 的切片做回归
import { parsePaddleJsonl, downloadImages, cropImage } from '@pdf-core/providers/paddleocr';
import { buildMineruLayout } from '@pdf-core/output/mineru-layout';
import { createFetchMock } from '../helpers/fetch-mock';

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const REAL = path.join(__dirname, '../fixtures/providers/paddleocr/real');
const ATT = fs.readFileSync(path.join(REAL, '1706.03762-pages-4-13-14.jsonl'), 'utf8');
const GELU = fs.readFileSync(path.join(REAL, '1606.08415-pages-1-2-7.jsonl'), 'utf8');
const TABLES = fs.readFileSync(path.join(REAL, '1706.03762-tables.jsonl'), 'utf8');

async function deliver(jsonl, { crop = async () => new Uint8Array([1, 2, 3]) } = {}) {
  const parsed = parsePaddleJsonl(jsonl);
  const fm = createFetchMock().on('https://pplines-online.bj.bcebos.com/', [{ body: new Uint8Array([9, 9, 9]) }], { sticky: true });
  const cropImage = jest.fn(crop);
  const images = await downloadImages(parsed.images, { fetch: fm.fetch, cropImage });
  const out = await buildMineruLayout({ markdown: parsed.markdown, images }, { subtle: webcrypto.subtle });
  return { parsed, images, out, cropImage, fm };
}

describe('P-2：图被识别成表格（Attention Fig 4）', () => {
  test('假表换成按 bbox 裁出的图片 + 图注；裁图进 ZIP', async () => {
    const { parsed, out, cropImage } = await deliver(ATT);
    const crop = parsed.images.find((i) => i.crop);
    expect(crop).toBeTruthy();
    expect(crop.url).toBe('https://pplines-online.bj.bcebos.com/fixture/1706.03762/preprocessed_img_14.jpg');
    expect(crop.crop).toEqual({ bbox: [212, 167, 1326, 1059], width: 1584, height: 1224 });
    expect(cropImage).toHaveBeenCalledTimes(1);
    expect(cropImage.mock.calls[0][1].bbox).toEqual([212, 167, 1326, 1059]);
    expect(out.markdown).not.toMatch(/<table[^>]*>\s*<tr>\s*<td[^>]*>\s*Figure 4/);
    expect(out.markdown).not.toMatch(/The Law will never be perfect/);
    expect(out.markdown).toMatch(/!\[\]\(images\/[0-9a-f]{64}\.jpg\)\s+(?:<div[^>]*>)?Figure 4: Two attention heads/);
    expect(out.markdown).toMatch(/Isolated attentions from just the word 'its'/); // 实体解码
    expect(out.images.map((i) => i.from)).toContain('page-3/imgs/img_in_image_box_212_167_1326_1059.jpg');
    expect(out.failedImages).toEqual([]);
  });

  test('真表格不受影响（首格不是 Figure N:）', () => {
    const jsonl = JSON.stringify({ errorCode: 0, result: { layoutParsingResults: [{ prunedResult: { width: 100, height: 100, parsing_res_list: [{ block_label: 'table', block_bbox: [0, 0, 50, 50], block_content: '<table><tr><td>Model</td><td>BLEU</td></tr></table>' }] }, markdown: { text: '<table><tr><td>Model</td><td>BLEU</td></tr></table>', images: {} } }], preprocessedImages: ['https://pplines-online.bj.bcebos.com/x.jpg'] } });
    const r = parsePaddleJsonl(jsonl);
    expect(r.markdown).toContain('<table>');
    expect(r.images).toEqual([]);
  });

  test('裁剪失败 → 单张图片失败，正文留注释，图注保留，任务不失败', async () => {
    const { out } = await deliver(ATT, { crop: async () => { throw new Error('crop unsupported'); } });
    expect(out.failedImages).toHaveLength(1);
    expect(out.markdown).toMatch(/<!-- 图片下载失败：page-3\/imgs\/img_in_image_box_212_167_1326_1059\.jpg -->/);
    expect(out.markdown).toMatch(/Figure 4: Two attention heads/);
  });

  test('同一页图多处裁剪只下载一次', async () => {
    const fm = createFetchMock().on('https://p/', [{ body: new Uint8Array([1]) }], { sticky: true });
    const crop = { bbox: [0, 0, 1, 1], width: 2, height: 2 };
    const imgs = await downloadImages([{ src: 'a', url: 'https://p/page.jpg', crop }, { src: 'b', url: 'https://p/page.jpg', crop }], { fetch: fm.fetch, cropImage: async () => new Uint8Array([7]) });
    expect(fm.callsTo('https://p/')).toHaveLength(1);
    expect(imgs.map((i) => i.contentType)).toEqual(['image/jpeg', 'image/jpeg']);
  });
});

describe('P-2：cropImage（createImageBitmap + OffscreenCanvas）', () => {
  afterEach(() => { delete global.createImageBitmap; delete global.OffscreenCanvas; });
  test('bbox 按位图实际尺寸缩放，输出 JPEG', async () => {
    const draw = jest.fn();
    global.createImageBitmap = jest.fn(async () => ({ width: 792, height: 612, close: jest.fn() }));
    global.OffscreenCanvas = jest.fn(function C(w, h) { this.w = w; this.h = h; this.getContext = () => ({ drawImage: draw }); this.convertToBlob = async (o) => ({ type: o.type, arrayBuffer: async () => new Uint8Array([5]).buffer }); });
    const out = await cropImage(new Uint8Array([1]), { bbox: [212, 167, 1326, 1059], width: 1584, height: 1224 });
    expect(Array.from(out)).toEqual([5]);
    expect(draw).toHaveBeenCalledWith(expect.anything(), 106, 83, 557, 446, 0, 0, 557, 446);
  });
  test('drawImage 抛错时位图仍然 close', async () => {
    const close = jest.fn();
    global.createImageBitmap = jest.fn(async () => ({ width: 10, height: 10, close }));
    global.OffscreenCanvas = jest.fn(function C() { this.getContext = () => ({ drawImage: () => { throw new Error('boom'); } }); });
    await expect(cropImage(new Uint8Array([1]), { bbox: [0, 0, 5, 5] })).rejects.toThrow('boom');
    expect(close).toHaveBeenCalledTimes(1);
  });
  test('正常裁剪也 close；越界抛错也 close', async () => {
    const close = jest.fn();
    global.createImageBitmap = jest.fn(async () => ({ width: 10, height: 10, close }));
    global.OffscreenCanvas = jest.fn(function C() { this.getContext = () => ({ drawImage() {} }); this.convertToBlob = async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }); });
    await cropImage(new Uint8Array([1]), { bbox: [0, 0, 5, 5] });
    await expect(cropImage(new Uint8Array([1]), { bbox: [20, 20, 30, 30] })).rejects.toThrow('out of range');
    expect(close).toHaveBeenCalledTimes(2);
  });
  test('环境不支持 → 抛错（由 downloadImages 记为单图失败）', async () => {
    await expect(cropImage(new Uint8Array([1]), { bbox: [0, 0, 1, 1] })).rejects.toThrow('crop unsupported');
  });
});

describe('P-3：表格单元格里的裸 LaTeX 补 $', () => {
  const { wrapCellMath, normalizeTables } = require('@pdf-core/normalize/table');
  test.each([
    ['1.0 \\cdot 10^{20}', '$1.0 \\cdot 10^{20}$'],
    ['d_{model}', '$d_{model}$'],
    ['\\epsilon_{ls}', '$\\epsilon_{ls}$'],
    ['P_{drop}', '$P_{drop}$'],
  ])('%s → %s', (a, b) => expect(wrapCellMath(a)).toBe(b));
  test.each([
    ['$ O(1) $'], ['params  $ \\times 10^{6} $'], ['Transformer (base model)'], ['28.4'], ['1.0e20'],
    ['see \\cite{x} for details'], ['<b>x_{1}</b>'], [''],
  ])('不动：%s', (a) => expect(wrapCellMath(a)).toBe(a));
  test('真实 Table 2 行：数学格补 $，文字格和数字格不动，td 属性保留', () => {
    const row = "<table><tr><td style='x'>Transformer (big)</td><td>28.4</td><td>2.3 \\cdot 10^{19}</td></tr></table>";
    expect(normalizeTables(row)).toBe("<table><tr><td style='x'>Transformer (big)</td><td>28.4</td><td>$2.3 \\cdot 10^{19}$</td></tr></table>");
  });
  test('表格外的文字不动', () => expect(normalizeTables('a_{1} \\cdot b')).toBe('a_{1} \\cdot b'));
  test('Attention 真实切片：Table 2/3 没有裸 LaTeX 单元格（修前 21 个）', async () => {
    const md = (await deliver(fs.readFileSync(path.join(REAL, '1706.03762-tables.jsonl'), 'utf8'))).out.markdown;
    expect(md).toContain('$1.0 \\cdot 10^{20}$');
    const bare = [...md.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]).filter((c) => /\\[A-Za-z]+|[\^_]\{/.test(c) && !c.includes('$'));
    expect(bare).toEqual([]);
  });
});

describe('P-4：公式编号 → \\tag{n}', () => {
  const { addFormulaTags } = require('@pdf-core/providers/paddleocr-blocks');
  test('Attention 第 4 页公式 (1) 带 \\tag{1}，只加一次', async () => {
    const md = (await deliver(ATT)).out.markdown;
    expect(md).toMatch(/Attention\(Q,K,V\)=softmax\(\\frac\{QK\^\{T\}\}\{\\sqrt\{d_\{k\}\}\}\)V\s*\\tag\{1\}\s*\$\$/);
    expect(md.match(/\\tag\{/g)).toHaveLength(1);
  });
  const pg = (blocks) => ({ prunedResult: { parsing_res_list: blocks } });
  const F = (y, c = '$$ a=b $$') => ({ block_label: 'display_formula', block_bbox: [100, y, 500, y + 40], block_content: c });
  const N = (y, c) => ({ block_label: 'formula_number', block_bbox: [900, y, 940, y + 20], block_content: c });
  test('按竖直位置配对最近的公式', () => {
    const t = '$$ a=b $$\n\n$$ c=d $$';
    expect(addFormulaTags(t, pg([F(100), F(300, '$$ c=d $$'), N(310, '(7)')]))).toBe('$$ a=b $$\n\n$$ c=d\\tag{7} $$');
  });
  test('编号不在任何公式的竖直范围内 / 编号格式怪 / 已有 \\tag → 不动', () => {
    const t = '$$ a=b $$';
    expect(addFormulaTags(t, pg([F(100), N(600, '(1)')]))).toBe(t);
    expect(addFormulaTags(t, pg([F(100), N(110, 'see text')]))).toBe(t);
    expect(addFormulaTags('$$ a \\tag{2} $$', pg([F(100, '$$ a \\tag{2} $$'), N(110, '(2)')]))).toBe('$$ a \\tag{2} $$');
  });
  test('支持 (A.1) 这类编号', () => {
    expect(addFormulaTags('$$ a=b $$', pg([F(100), N(110, '(A.1)')]))).toBe('$$ a=b\\tag{A.1} $$');
  });
});

describe('P-5：被段落切断的行内公式', () => {
  const { mergeSplitInlineMath } = require('@pdf-core/normalize/math');
  test('GELU 真实切片：Φ(x)=P(X≤x) 合回一个段落、一个公式', async () => {
    const md = (await deliver(GELU)).out.markdown;
    expect(md).toMatch(/\$ \\Phi\(x\) = P\(X \\leq x\), X \\sim \\mathcal\{N\}\(0,1\) \$ is the cumulative/);
    expect(md).not.toMatch(/\n\$ x\), X/);
  });
  test.each([
    ['正常段落', 'a $x$ b\n\n$y$ c'],
    ['括号都闭合', 'a $ f(x) $\n\n$ y) $ c'],
    ['下一段不以公式开头', 'a $ P(X \\leq $\n\nx) $ y $'],
    ['下一段公式括号平衡', 'a $ P(X \\leq $\n\n$ (y) $ c'],
    ['块公式', 'a $ P(X $\n\n$$ y) $$'],
    ['标题', '## A $ P(X $\n\n$ y) $ c'],
  ])('不合并：%s', (_, t) => expect(mergeSplitInlineMath(t)).toBe(t));
  test('最小例子', () => expect(mergeSplitInlineMath('where $ P(a \\leq $\n\n$ b) $ is')).toBe('where $ P(a \\leq b) $ is'));
});

describe('P-6：\\mathrm / \\text 里的拆字母', () => {
  const { joinSpacedLetters } = require('@pdf-core/normalize/math');
  test.each([
    ['$ \\mathrm{G E L U}(x) $', '$ \\mathrm{GELU}(x) $'],
    ['$ \\mathrm{e r f}(x) $', '$ \\mathrm{erf}(x) $'],
    ['$ d_{\\mathrm{m o d e l}} $', '$ d_{\\mathrm{model}} $'],
    ['$ \\mathbf{z}_{\\mathrm{c l a s s;}} $', '$ \\mathbf{z}_{\\mathrm{class;}} $'],
    ['$ \\mathrm{M S A}(\\mathrm{L N}(z)) $', '$ \\mathrm{MSA}(\\mathrm{LN}(z)) $'],
    ['$ \\operatorname{s o f t m a x} $', '$ \\operatorname{softmax} $'],
  ])('%s', (i, o) => expect(joinSpacedLetters(i)).toBe(o));
  test.each([
    '$ x \\text{and } y $', '$ \\text{for any } x $', '$ \\mathrm{LN} $', '$ \\mathbf{x} $',
    '$ \\mathrm{x} $', 'l r a t e', '`\\mathrm{a b}`',
  ])('不动：%s', (t) => expect(joinSpacedLetters(t)).toBe(t));
  test('走完整 normalizeMarkdown', () => {
    const { normalizeMarkdown } = require('@pdf-core/normalize');
    expect(normalizeMarkdown('$$ \\mathrm{G E L U}(x)=x\\Phi(x) $$').markdown).toContain('\\mathrm{GELU}(x)');
  });
});

describe('P-8：去掉居中 div 和表格展示属性', () => {
  const { cleanPaddleHtml } = require('@pdf-core/providers/paddleocr-blocks');
  test('居中 div 拆壳', () => {
    expect(cleanPaddleHtml('<div style="text-align: center;"><img src="imgs/a.jpg" alt="Image" width="40%" /></div>'))
      .toBe('<img src="imgs/a.jpg" alt="Image" width="40%" />');
    expect(cleanPaddleHtml('<div style="text-align: center;">Figure 1: x</div>')).toBe('Figure 1: x');
    expect(cleanPaddleHtml('<div class="x">k</div>')).toBe('<div class="x">k</div>');
  });
  test('表格只留 colspan/rowspan', () => {
    const t = `<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;' colspan="2">a</td><td rowspan=2 style='x'>b</td></tr></table>`;
    expect(cleanPaddleHtml(t)).toBe('<table><tr><td colspan="2">a</td><td rowspan=2>b</td></tr></table>');
  });
  test('真实 1706 表格页：交付结果里没有 border/style/居中 div，合并单元格还在', async () => {
    const { out } = await deliver(TABLES);
    const md = out.markdown;
    expect(md).not.toMatch(/border=|style=|text-align/);
    expect(md).toMatch(/<td (colspan|rowspan)=/);
    expect(md).toMatch(/<table>/);
  });
  test('真实图片：不再有 div 包着的 img', async () => {
    const { out } = await deliver(ATT);
    expect(out.markdown).not.toMatch(/<div style/);
    expect(out.markdown).toMatch(/!\[[^\]]*\]\(images\//);
  });
});

describe('P-7：被当成页眉丢掉的节标题', () => {
  const { restoreDroppedHeadings } = require('@pdf-core/providers/paddleocr-blocks');
  const blk = (label, content, bbox) => ({ block_label: label, block_content: content, block_bbox: bbox });
  const pg = (...b) => ({ prunedResult: { parsing_res_list: b } });
  test('GELU 真实页：## ACKNOWLEDGMENT 回到致谢段落前', async () => {
    const md = (await deliver(GELU)).out.markdown;
    expect(md).toMatch(/## ACKNOWLEDGMENT\n\nWe would like to thank NVIDIA/);
  });
  test('全大写编号节标题也恢复', () => {
    const p = pg(blk('header', 'A NEURAL NETWORK ARCHITECTURE FOR CIFAR-10 EXPERIMENTS', [100, 100, 900, 120]),
      blk('text', 'We use a shallow architecture with two convolutional layers.', [100, 130, 900, 200]));
    expect(restoreDroppedHeadings('x\n\nWe use a shallow architecture with two convolutional layers.', p))
      .toBe('x\n\n## A NEURAL NETWORK ARCHITECTURE FOR CIFAR-10 EXPERIMENTS\n\nWe use a shallow architecture with two convolutional layers.');
  });
  test.each([
    'Published as a conference paper at ICLR 2015',
    'Scaled Dot-Product Attention',
    'Provided proper attribution is provided, Google hereby grants',
  ])('真页眉不动：%s', (h) => {
    const t = 'We use a shallow architecture with two convolutional layers.';
    expect(restoreDroppedHeadings(t, pg(blk('header', h, [100, 10, 900, 30]), blk('text', t, [100, 40, 900, 90])))).toBe(t);
  });
  const T = 'We use a shallow architecture with two convolutional layers.';
  const one = (h) => pg(blk('header', h, [100, 10, 900, 30]), blk('text', T, [100, 40, 900, 90]));
  test.each(['A PREPRINT - OCTOBER 12, 2023', 'A TECHNICAL REPORT', 'A WORKSHOP PAPER AT NEURIPS 2023'])('模板页眉词不当标题：%s', (h) => {
    expect(restoreDroppedHeadings(T, one(h))).toBe(T);
  });
  test('跨页重复的页眉不恢复（parsePaddleJsonl 全文统计）', () => {
    const page = (h) => ({ markdown: { text: T }, prunedResult: { parsing_res_list: [blk('header', h, [100, 10, 900, 30]), blk('text', T, [100, 40, 900, 90])] } });
    const jsonl = JSON.stringify({ result: { layoutParsingResults: [page('B SOME REPEATED RUNNING TITLE'), page('B SOME REPEATED RUNNING TITLE')] } });
    expect(parsePaddleJsonl(jsonl).markdown).not.toMatch(/#+ B SOME/);
    const { repeatedHeaders } = require('@pdf-core/providers/paddleocr-blocks');
    expect(restoreDroppedHeadings(T, one('B SOME REPEATED RUNNING TITLE'), { repeated: repeatedHeaders([one('B SOME REPEATED RUNNING TITLE'), one('B SOME REPEATED RUNNING TITLE')]) })).toBe(T);
    expect(restoreDroppedHeadings(T, one('B SOME REPEATED RUNNING TITLE'))).toMatch(/^## B SOME/);
  });
  test.each([
    ['3 EXPERIMENTS AND RESULTS', '##'], ['3.2 EXPERIMENTAL SETUP', '###'], ['3.2.1 DATA AND METRICS', '####'], ['B HISTORY OF THE GELU', '##'], ['ACKNOWLEDGMENTS', '##'],
  ])('层级按编号深度：%s → %s', (h, lv) => expect(restoreDroppedHeadings(T, one(h))).toBe(`${lv} ${h}\n\n${T}`));
  test('已有同名标题不重复', () => {
    const t = '## ACKNOWLEDGMENT\n\nWe would like to thank everyone involved here.';
    expect(restoreDroppedHeadings(t, pg(blk('header', 'ACKNOWLEDGMENT', [0, 0, 500, 20]), blk('text', 'We would like to thank everyone involved here.', [0, 30, 500, 80])))).toBe(t);
  });
});

describe('P-2：页图缓存用完即释放', () => {
  test('每页最后一张裁图完成后缓存项删除，仍只下载一次', async () => {
    const fm = createFetchMock().on('https://p/', [{ body: new Uint8Array([1]) }], { sticky: true });
    const crop = { bbox: [0, 0, 1, 1], width: 2, height: 2 };
    const pageCache = new Map(); const sizes = [];
    const cropImage = async () => { sizes.push(pageCache.size); return new Uint8Array([7]); };
    await downloadImages([{ src: 'a', url: 'https://p/1.jpg', crop }, { src: 'b', url: 'https://p/1.jpg', crop }, { src: 'c', url: 'https://p/2.jpg', crop }], { fetch: fm.fetch, cropImage, pageCache }, 1);
    expect(fm.callsTo('https://p/')).toHaveLength(2);
    expect(sizes).toEqual([1, 1, 1]); // 第 1 页裁完才释放，第 2 页开始时缓存里只剩它
    expect(pageCache.size).toBe(0);
  });
  test('裁剪抛错也释放', async () => {
    const fm = createFetchMock().on('https://p/', [{ body: new Uint8Array([1]) }], { sticky: true });
    const pageCache = new Map();
    const imgs = await downloadImages([{ src: 'a', url: 'https://p/1.jpg', crop: { bbox: [0, 0, 1, 1] } }], { fetch: fm.fetch, cropImage: async () => { throw new Error('x'); }, pageCache });
    expect(imgs[0].error).toBe('x');
    expect(pageCache.size).toBe(0);
  });
});
