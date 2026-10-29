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

/** 下载失败的图：整个 <img>/<div 包裹>/![]() 换成注释，正文不留坏链接 */
export function markFailedImages(md, failedSrcs) {
  let out = md;
  for (const src of failedSrcs) {
    const e = escRe(src); const note = `<!-- 图片下载失败：${src} -->`;
    out = out
      .replace(new RegExp(`<div[^>]*>\\s*<img\\b[^>]*\\bsrc\\s*=\\s*["']${e}["'][^>]*>\\s*</div>`, 'gi'), note)
      .replace(new RegExp(`<img\\b[^>]*\\bsrc\\s*=\\s*["']${e}["'][^>]*>`, 'gi'), note)
      .replace(new RegExp(`!\\[[^\\]]*\\]\\(\\s*<?${e}>?(?:\\s+"[^"]*")?\\)`, 'g'), note);
  }
  return out;
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
  return { markdown: norm.markdown, images, deliver: 'zip', layout: 'mineru', failedImages: failed };
}
