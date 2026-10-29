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
