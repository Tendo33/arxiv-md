// 图片统一命名 figures/fig-{页}-{序号}.{ext}，markdown / <img> 链接同步改
import { withCodeProtected } from './protect.js';

const PAGE_RE = /(?:^|[_\-/])(?:page|p)[_-]?(\d+)/i;
export function defaultPageOf(src) { const m = PAGE_RE.exec(src); return m ? Number(m[1]) : 1; }

/**
 * @param {string} md
 * @param {{pageOf?:(src:string)=>number}} [opts]
 * @returns {{markdown:string, images:{from:string,to:string}[]}}
 */
export function normalizeImages(md, { pageOf = defaultPageOf } = {}) {
  const map = new Map(); const perPage = new Map(); const images = [];
  const rename = (src) => {
    if (/^(data:|https?:)/i.test(src)) return src; // 远程/内联图不改
    if (map.has(src)) return map.get(src);
    const page = Math.max(1, Number(pageOf(src)) || 1);
    const n = (perPage.get(page) || 0) + 1; perPage.set(page, n);
    const ext = ((/\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(src) || [])[1] || 'png').toLowerCase();
    const to = `figures/fig-${page}-${n}.${ext}`;
    map.set(src, to); images.push({ from: src, to });
    return to;
  };
  const markdown = withCodeProtected(md, (s) => s
    .replace(/(!\[[^\]]*\]\()\s*<?([^)\s>]+)>?((?:\s+"[^"]*")?\))/g, (_, a, src, b) => `${a}${rename(src)}${b}`)
    .replace(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (_, a, q, src) => `${a}${q}${rename(src)}${q}`));
  return { markdown, images };
}
