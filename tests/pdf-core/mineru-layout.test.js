// 路线 2：PaddleOCR 交付结构对齐 MinerU（full.md + images/<sha256>.<ext>，一律 ZIP）
import { createHash } from 'crypto';
import { webcrypto } from 'crypto';
import { buildMineruLayout, markFailedImages, sha256Hex } from '@pdf-core/output/mineru-layout';
import { buildDeliverable } from '@pdf-core/output/save';

const subtle = (globalThis.crypto && globalThis.crypto.subtle) || webcrypto.subtle;
const hex = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex');

/** 读 ZIP 中央目录里的文件名 */
async function zipNames(blob) {
  const b = Buffer.from(await blob.arrayBuffer()); const names = [];
  for (let i = 0; i < b.length - 46; i++) {
    if (b.readUInt32LE(i) === 0x02014b50) { const n = b.readUInt16LE(i + 28); names.push(b.slice(i + 46, i + 46 + n).toString('utf8')); }
  }
  return names;
}

const A = new Uint8Array([1, 2, 3]); const B = new Uint8Array([9, 9]);
const fetched = {
  markdown: '# T\n\n<div style="text-align: center;"><img src="page-1/imgs/a.jpg" alt="Image" width="38%" /></div>\n\n![](page-2/imgs/b.png)\n\n<img src="page-3/imgs/a.jpg" />\n\n![x](page-4/imgs/gone.jpg)',
  images: [
    { src: 'page-1/imgs/a.jpg', data: A }, { src: 'page-2/imgs/b.png', data: B },
    { src: 'page-3/imgs/a.jpg', data: A }, // 内容相同 → 同一个 sha 文件
    { src: 'page-4/imgs/gone.jpg', data: null, error: 'HTTP 404' },
  ],
};

test('sha256Hex 与 node crypto 一致', async () => {
  expect(await sha256Hex(A, subtle)).toBe(hex(A));
});

test('引用改成 images/<sha256>.<ext>；同内容去重；下载失败的图换成注释', async () => {
  const r = await buildMineruLayout(fetched, { subtle });
  expect(r).toMatchObject({ deliver: 'zip', layout: 'mineru', failedImages: ['page-4/imgs/gone.jpg'] });
  expect(r.markdown).toContain(`![](images/${hex(A)}.jpg)`); // 和 MinerU 一样用 ![]()，不再保留 <img>
  expect(r.markdown).toContain(`![](images/${hex(B)}.png)`);
  expect(r.markdown.match(new RegExp(`images/${hex(A)}\\.jpg`, 'g'))).toHaveLength(2);
  expect(r.markdown).toContain('<!-- 图片下载失败：page-4/imgs/gone.jpg -->');
  expect(r.markdown.replace(/<!--[^>]*-->/g, '')).not.toMatch(/page-\d+\/imgs|figures\//);
  expect(r.images.map((i) => i.to).sort()).toEqual([`images/${hex(A)}.jpg`, `images/${hex(B)}.png`].sort());
});

test('ZIP 内容：full.md + images/<sha>（不重复），没有 paper.md / figures/；文件名同 MinerU（标题.zip）', async () => {
  const r = await buildMineruLayout(fetched, { subtle });
  const d = buildDeliverable(r, 'Title (2017)');
  expect(d.filename).toBe('Title (2017).zip');
  expect((await zipNames(d.blob)).sort()).toEqual(['full.md', `images/${hex(A)}.jpg`, `images/${hex(B)}.png`].sort());
});

test('没有图片也交付 ZIP（只有 full.md），和 MinerU 一致', async () => {
  const r = await buildMineruLayout({ markdown: '# only text', images: [] }, { subtle });
  const d = buildDeliverable(r, 'P');
  expect(d.filename).toBe('P.zip');
  expect(await zipNames(d.blob)).toEqual(['full.md']);
});

test('frontmatter 照旧（includeMetadata 打开时）；公式整理照旧', async () => {
  const r = await buildMineruLayout({ markdown: 'x \\(a\\) y', images: [] }, { subtle, meta: { title: 'T', source: 'paddleocr' } });
  expect(r.markdown.startsWith('---\n')).toBe(true);
  expect(r.markdown).toContain('source: paddleocr');
  expect(r.markdown).toContain('$a$');
});

test('markFailedImages：三种写法都替换，其他图不动', () => {
  const md = '<div style="x"><img src="p/a.jpg"/></div>\n<img src=\'p/a.jpg\'>\n![t](p/a.jpg "c")\n![k](p/b.jpg)';
  const out = markFailedImages(md, ['p/a.jpg']);
  expect(out.match(/图片下载失败/g)).toHaveLength(3);
  expect(out).toContain('![k](p/b.jpg)');
});

test('旧布局不受影响：非 mineru layout 仍是 paper.md + figures/', async () => {
  const d = buildDeliverable({ markdown: 'm', images: [{ to: 'figures/fig-1-1.png', data: A }] }, 'P');
  expect(await zipNames(d.blob)).toEqual(['paper.md', 'figures/fig-1-1.png']);
});

describe('图片引用写法对齐 MinerU：![](images/<sha>.<ext>)', () => {
  const { imgTagsToMarkdown, buildMineruLayout: build } = require('@pdf-core/output/mineru-layout');
  test('<div><img src width></div> 和裸 <img> 都换成 ![]()；非 images/ 的 <img> 不动', () => {
    const md = '<div style="text-align: center;"><img src="images/ab.jpg" alt="Image" width="43%" /></div>\n\ntext <img src="images/cd.png"> x <img src="https://e.com/a.png">';
    expect(imgTagsToMarkdown(md)).toBe('![](images/ab.jpg)\n\ntext ![](images/cd.png) x <img src="https://e.com/a.png">');
  });
  test('buildMineruLayout 产出的 full.md 里没有 <img>，引用的文件都在 images 里', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const r = await build({ markdown: '# T\n\n<div style="text-align: center;"><img src="page-1/imgs/a.jpg" alt="Image" width="40%" /></div>', images: [{ src: 'page-1/imgs/a.jpg', data, contentType: 'image/jpeg' }] });
    expect(r.markdown).not.toMatch(/<img/);
    const refs = [...r.markdown.matchAll(/!\[\]\((images\/[0-9a-f]{64}\.jpg)\)/g)].map((m) => m[1]);
    expect(refs).toHaveLength(1);
    expect(r.images.map((i) => i.to)).toEqual(refs);
  });
});
