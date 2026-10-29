// PaddleOCR 版面块（prunedResult.parsing_res_list）后处理：markdown.text 丢掉的信息从版面块里补回来。
// 每个函数只做一件事，输入是单页 markdown 文本和该页的版面块，找不到可靠对应时原样返回（宁可不修也不误改）。

const decodeEntities = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const plain = (html) => decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const blocksOf = (pg) => ((pg && pg.prunedResult && pg.prunedResult.parsing_res_list) || []).filter((b) => b && Array.isArray(b.block_bbox));

const CAPTION_RE = /^(?:Figure|Fig\.)\s*\d+[A-Za-z]?\s*[:.]/;

/**
 * P-4：formula_number 块（如 "(1)"）配到同一页、竖直方向重叠且最近的 display_formula，给该公式补 \tag{n}（MinerU 写法）。
 */
export function addFormulaTags(text, pg) {
  const blocks = blocksOf(pg);
  const formulas = blocks.filter((b) => b.block_label === 'display_formula');
  let out = text;
  for (const nb of blocks.filter((b) => b.block_label === 'formula_number')) {
    const m = /^\s*\(?\s*([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)\s*\)?\s*$/.exec(nb.block_content || '');
    if (!m) continue;
    const cy = (nb.block_bbox[1] + nb.block_bbox[3]) / 2;
    const cands = formulas
      .filter((f) => cy >= f.block_bbox[1] - 8 && cy <= f.block_bbox[3] + 8 && f.block_bbox[0] < nb.block_bbox[0])
      .sort((a, b) => Math.abs((a.block_bbox[1] + a.block_bbox[3]) / 2 - cy) - Math.abs((b.block_bbox[1] + b.block_bbox[3]) / 2 - cy));
    const f = cands[0];
    if (!f) continue;
    const src = String(f.block_content || '').trim();
    if (!src.endsWith('$$') || /\\tag\{/.test(src)) continue;
    const at = out.indexOf(src);
    if (at < 0) continue;
    const tagged = `${src.slice(0, -2).trimEnd()}\\tag{${m[1]}} $$`;
    out = out.slice(0, at) + tagged + out.slice(at + src.length);
    f.block_content = tagged; // 同一公式不重复加
  }
  return out;
}

/**
 * P-2：图被版面模型标成 table（Attention Fig 4：首格就是「Figure 4: …」图注）。
 * 把这张假表换成按 bbox 从预处理页图裁出来的图片 + 图注；返回待裁剪的图片描述（由 downloadImages 裁剪）。
 * @returns {{text:string, crops:{name:string, bbox:number[], width:number, height:number}[]}}
 */
export function replaceFigureTables(text, pg) {
  const crops = [];
  const pr = (pg && pg.prunedResult) || {};
  let out = text;
  for (const b of blocksOf(pg).filter((x) => x.block_label === 'table')) {
    const first = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/i.exec(b.block_content || '');
    const caption = first ? plain(first[1]) : '';
    if (!CAPTION_RE.test(caption)) continue;
    const key = caption.slice(0, 40);
    let replaced = false;
    out = out.replace(/<table\b[\s\S]*?<\/table>/gi, (tbl) => {
      if (replaced || !plain(tbl).startsWith(key)) return tbl;
      replaced = true;
      const name = `imgs/img_in_image_box_${b.block_bbox.map((n) => Math.round(n)).join('_')}.jpg`;
      crops.push({ name, bbox: b.block_bbox.slice(0, 4), width: pr.width || null, height: pr.height || null });
      return `<div style="text-align: center;"><img src="${name}" alt="Image" /></div>\n\n<div style="text-align: center;">${caption}</div>`;
    });
  }
  return { text: out, crops };
}

/** 单页总入口 */
export function fixPageFromBlocks(text, pg) {
  const r = replaceFigureTables(addFormulaTags(text, pg), pg);
  return { text: r.text, crops: r.crops };
}
