// PaddleOCR 版面块（prunedResult.parsing_res_list）后处理：markdown.text 丢掉的信息从版面块里补回来。
// 每个函数只做一件事，输入是单页 markdown 文本和该页的版面块，找不到可靠对应时原样返回（宁可不修也不误改）。

const decodeEntities = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const plain = (html) => decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const blocksOf = (pg) => ((pg && pg.prunedResult && pg.prunedResult.parsing_res_list) || []).filter((b) => b && Array.isArray(b.block_bbox));

const CAPTION_RE = /^(?:Figure|Fig\.)\s*\d+[A-Za-z]?\s*[:.]/;

/**
 * P-4：formula_number 块（如 "(1)"）配到同一页、竖直方向重叠且最近的 display_formula，给该公式补 \tag{n}（MinerU 写法）。
 */
export function addFormulaTags(text, pg) {
  const blocks = blocksOf(pg);
  const formulas = blocks.filter((b) => b.block_label === 'display_formula');
  let out = text;
  const done = new Set(); // 已加过 \tag 的公式块（局部记录，不改调用方的 pg）
  for (const nb of blocks.filter((b) => b.block_label === 'formula_number')) {
    const m = /^\s*\(?\s*([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)\s*\)?\s*$/.exec(nb.block_content || '');
    if (!m) continue;
    const cy = (nb.block_bbox[1] + nb.block_bbox[3]) / 2;
    const cands = formulas
      .filter((f) => cy >= f.block_bbox[1] - 8 && cy <= f.block_bbox[3] + 8 && f.block_bbox[0] < nb.block_bbox[0])
      .sort((a, b) => Math.abs((a.block_bbox[1] + a.block_bbox[3]) / 2 - cy) - Math.abs((b.block_bbox[1] + b.block_bbox[3]) / 2 - cy));
    const f = cands[0];
    if (!f || done.has(f)) continue;
    const src = String(f.block_content || '').trim();
    if (!src.endsWith('$$') || /\\tag\{/.test(src)) continue;
    const at = out.indexOf(src);
    if (at < 0) continue;
    const tagged = `${src.slice(0, -2).trimEnd()}\\tag{${m[1]}} $$`;
    out = out.slice(0, at) + tagged + out.slice(at + src.length);
    done.add(f);
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
      return `<div style="text-align: center;"><img src="${name}" alt="Image" /></div>\n\n<div style="text-align: center;">${escapeHtml(caption)}</div>`;
    });
  }
  return { text: out, crops };
}

const ACK_RE = /^\s*(?:\d+\.?\s*)?acknowledge?ments?\s*$/i;
const CAPS_SECTION_RE = /^\s*(?:[A-Z]|\d+(?:\.\d+)*)\.?\s+[A-Z][A-Z0-9 ,:-]{8,}$/;
// arXiv 模板页眉常用词：命中就不当节标题（「A PREPRINT - OCTOBER 12, 2023」「A TECHNICAL REPORT」）
const TEMPLATE_HEADER_RE = /\b(?:PREPRINT|TECHNICAL REPORT|UNDER REVIEW|WORKSHOP|CONFERENCE|ARXIV)\b/i;
const normHeader = (s) => String(s || '').trim().replace(/\s+/g, ' ');
/** 编号深度定层级：「3」「A」→ ##，「3.2」→ ###，「3.2.1」→ ####（最多 ######）；致谢 → ## */
const headingLevel = (title) => {
  const m = /^\s*(\d+(?:\.\d+)*)/.exec(title);
  return '#'.repeat(Math.min(6, 1 + (m ? m[1].split('.').length : 1)));
};
/** 在 ≥2 页的 header 块里重复出现的文字（页眉页脚模板） */
export function repeatedHeaders(pages) {
  const seen = new Map();
  for (const pg of pages) {
    const texts = new Set(blocksOf(pg).filter((b) => b.block_label === 'header').map((b) => normHeader(b.block_content)));
    for (const t of texts) seen.set(t, (seen.get(t) || 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n >= 2).map(([t]) => t));
}

/**
 * P-7：版面模型把「ACKNOWLEDGMENT」这类节标题标成 header（页眉），markdown_ignore_labels 会把它整块丢掉。
 * 只恢复两类确定是节标题的 header：致谢，以及全大写、带编号的节标题（如 GELU 附录「A NEURAL NETWORK …」）。
 * 跨页重复的页眉模板和带模板词的页眉不恢复；层级按编号深度。
 * 插到它正下方第一个能在正文里找到的块前面。「Published as a conference paper …」这类真页眉不碰。
 * 标题大小写被模型改写（3.3 Twitter POS Tagging）来自 block_content 本身，属已知问题。
 * @param {{repeated?: Set<string>}} [opts] repeated：repeatedHeaders(全部页) 的结果
 */
export function restoreDroppedHeadings(text, pg, { repeated } = {}) {
  const blocks = blocksOf(pg);
  let out = text;
  for (const h of blocks.filter((b) => b.block_label === 'header')) {
    const title = normHeader(h.block_content);
    const ack = ACK_RE.test(title);
    if (!ack && (!CAPS_SECTION_RE.test(title) || TEMPLATE_HEADER_RE.test(title))) continue;
    if (repeated && repeated.has(title)) continue;
    if (out.includes(`# ${title}`)) continue;
    const below = blocks
      .filter((b) => b !== h && b.block_bbox[1] >= h.block_bbox[3] - 2 && b.block_bbox[0] < h.block_bbox[2] && b.block_bbox[2] > h.block_bbox[0])
      .sort((a, b) => a.block_bbox[1] - b.block_bbox[1]);
    for (const nb of below) {
      const head = String(nb.block_content || '').trim().slice(0, 60);
      if (head.length < 20) continue;
      const at = out.indexOf(head);
      if (at < 0) continue;
      out = `${out.slice(0, at)}${ack ? '##' : headingLevel(title)} ${title}\n\n${out.slice(at)}`;
      break;
    }
  }
  return out;
}

/** 单页总入口 */
export function fixPageFromBlocks(text, pg, opts = {}) {
  const r = replaceFigureTables(addFormulaTags(text, pg), pg);
  return { text: restoreDroppedHeadings(r.text, pg, opts), crops: r.crops };
}

/**
 * P-8：PaddleOCR 的展示性 HTML 外壳。
 * - 去掉 <div style="text-align: center;">…</div>（图片、图注、表格外面都有），内容原样保留；
 * - 表格标签只保留 colspan/rowspan，去掉 border= / style= 等展示属性。
 * 只认 PaddleOCR 生成的这一种居中 div，别的 div 不动。
 */
const CENTER_DIV = /<div style=(["'])text-align:\s*center;?\1>([\s\S]*?)<\/div>/g;
export function cleanPaddleHtml(text) {
  return text
    .replace(CENTER_DIV, (_, __, inner) => inner.trim())
    .replace(/<(table|thead|tbody|tr|td|th)\b([^>]*)>/gi, (_, tag, attrs) => {
      const keep = attrs.match(/\b(?:colspan|rowspan)\s*=\s*(?:"[^"]*"|'[^']*'|\d+)/gi) || [];
      return `<${tag}${keep.map((a) => ` ${a}`).join('')}>`;
    });
}
