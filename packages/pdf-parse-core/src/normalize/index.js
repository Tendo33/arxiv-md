// R4-09：统一的输出整理流程（PaddleOCR 默认使用；MinerU 由 normalizeMinerU 开关控制，默认关）
import { normalizeMath } from './math.js';
import { normalizeTables, htmlTableToGfm } from './table.js';
import { normalizeImages, defaultPageOf } from './images.js';
import { addFrontMatter, buildFrontMatter, escapeYaml } from './frontmatter.js';

/**
 * @param {string} md provider 原始 Markdown
 * @param {{meta?:object, tablesToGfm?:boolean, pageOf?:(src:string)=>number, rename?:(src:string)=>string|undefined}} [opts]
 * @returns {{markdown:string, images:{from:string,to:string}[], deliver:'md'|'zip'}}
 */
export function normalizeMarkdown(md, { meta = null, tablesToGfm = false, pageOf, rename } = {}) {
  let out = normalizeMath(md);
  out = normalizeTables(out, { toGfm: tablesToGfm });
  const img = normalizeImages(out, { pageOf, rename });
  out = addFrontMatter(img.markdown.replace(/\n{3,}/g, '\n\n').trim() + '\n', meta);
  return { markdown: out, images: img.images, deliver: img.images.length ? 'zip' : 'md' };
}

/** 该 provider 的结果是否走整理流程：output='markdown' 一律走；MinerU(zip) 只有开关打开才走 */
export function shouldNormalize(provider, { normalizeMinerU = false } = {}) {
  if (!provider) return false;
  if (provider.output === 'markdown') return true;
  return provider.id === 'mineru' && normalizeMinerU === true;
}

export { normalizeMath, normalizeTables, htmlTableToGfm, normalizeImages, defaultPageOf, addFrontMatter, buildFrontMatter, escapeYaml };
