// PaddleOCR 对齐 MinerU 的交付结构：full.md + images/<sha256(图片字节)>.<ext>
// MinerU 官方 ZIP 的图片就是按内容哈希命名（images/<sha256>.jpg），正文文件名 full.md。
import { normalizeMarkdown } from '../normalize/index.js';

const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

export async function sha256Hex(bytes, subtle = globalThis.crypto && globalThis.crypto.subtle) {
  const buf = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function extOf(img) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(String(img.src || '').split(/[?#]/)[0]);
  if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  return EXT_BY_TYPE[String(img.contentType || '').split(';')[0].trim()] || 'jpg';
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * QA L-04：下载失败（quality 分支上裁剪失败也走这里）的图在渲染后的 Markdown 里要看得见，
 * 所以是一行引用块而不是 HTML 注释；前后空行保证它在行内位置也单独成段
 */
export const failedImageNote = (src) => `\n\n> ⚠️ 图片下载失败（image failed to download）：\`${src}\`\n\n`;

/** 下载失败的图：整个 <img>/<div 包裹>/![]() 换成可见提示，正文不留坏链接 */
export function markFailedImages(md, failedSrcs) {
  let out = md;
  for (const src of failedSrcs) {
    const e = escRe(src); const note = failedImageNote(src);
    out = out
      .replace(new RegExp(`<div[^>]*>\\s*<img\\b[^>]*\\bsrc\\s*=\\s*["']${e}["'][^>]*>\\s*</div>`, 'gi'), note)
      .replace(new RegExp(`<img\\b[^>]*\\bsrc\\s*=\\s*["']${e}["'][^>]*>`, 'gi'), note)
      .replace(new RegExp(`!\\[[^\\]]*\\]\\(\\s*<?${e}>?(?:\\s+"[^"]*")?\\)`, 'g'), note);
  }
  return out;
}

/** MinerU 的 full.md 用 ![](images/<sha>.jpg)；PaddleOCR 给的是 <div><img src width></div>，统一成 MinerU 写法（只动 images/ 下的引用） */
export function imgTagsToMarkdown(md) {
  const one = (tag) => {
    const m = /\bsrc\s*=\s*["'](images\/[^"']+)["']/i.exec(tag);
    return m ? `![](${m[1]})` : null;
  };
  const conv = (part) => part
    .replace(/<div\b[^>]*>\s*(<img\b[^>]*>)\s*<\/div>/gi, (all, img) => { const r = one(img); return r ? r : all; })
    .replace(/<img\b[^>]*>/gi, (img) => one(img) || img);
  // P3-4：HTML 表格里的 <img> 保持原样——表格单元格里的 ![]() 不会被渲染成图片
  return String(md).split(/(<table\b[\s\S]*?<\/table>)/i).map((part) => (/^<table\b/i.test(part) ? part : conv(part))).join('');
}

/**
 * @param {{markdown:string, images:{src:string,data?:Uint8Array|null,contentType?:string}[]}} fetched
 * @param {{meta?:object, subtle?:SubtleCrypto}} [opts]
 * @returns {Promise<{markdown:string, images:{from:string,to:string,data:Uint8Array}[], deliver:'zip', layout:'mineru', failedImages:string[]}>}
 */
export async function buildMineruLayout(fetched, { meta = null, subtle } = {}) {
  const names = new Map(); const data = new Map(); const failed = [];
  for (const img of fetched.images || []) {
    if (!img.data || !img.data.length) { failed.push(img.src); continue; }
    const to = `images/${await sha256Hex(img.data, subtle)}.${extOf(img)}`;
    names.set(img.src, to); data.set(to, img.data);
  }
  const md = markFailedImages(fetched.markdown || '', failed);
  const norm = normalizeMarkdown(md, { meta, rename: (src) => names.get(src) });
  const images = norm.images.filter((i) => data.has(i.to)).map((i) => ({ ...i, data: data.get(i.to) }));
  return { markdown: imgTagsToMarkdown(norm.markdown), images, deliver: 'zip', layout: 'mineru', failedImages: failed };
}
