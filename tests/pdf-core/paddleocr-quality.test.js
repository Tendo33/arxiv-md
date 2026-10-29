// PaddleOCR 输出质量对齐 MinerU（fix/paddleocr-quality）：用 2026-10-29 真实 JSONL 的切片做回归
import { parsePaddleJsonl, downloadImages, cropImage } from '@pdf-core/providers/paddleocr';
import { buildMineruLayout } from '@pdf-core/output/mineru-layout';
import { createFetchMock } from '../helpers/fetch-mock';

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const REAL = path.join(__dirname, '../fixtures/providers/paddleocr/real');
const ATT = fs.readFileSync(path.join(REAL, '1706.03762-pages-4-13-14.jsonl'), 'utf8');
const GELU = fs.readFileSync(path.join(REAL, '1606.08415-pages-1-7.jsonl'), 'utf8');

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
