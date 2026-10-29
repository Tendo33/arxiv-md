import { API } from '@config/constants';
import logger from '@utils/logger';
import { isAr5ivHtmlAvailable } from './ar5iv-availability';

export const HTML_PAPER_SOURCES = [
  { id: 'arxiv-html', label: 'arXiv HTML', base: API.ARXIV_HTML_BASE },
  { id: 'ar5iv', label: 'ar5iv', base: API.AR5IV_BASE },
];

const PDF_TIER = 'pdf';

/**
 * Official HTML and ar5iv both wrap the paper in `<article class="ltx_document">`.
 * An error page or an abstract redirect does not.
 */
export function hasLtxDocument(html) {
  return typeof html === 'string'
    && /<article\b[\s\S]{0,500}?class\s*=\s*["'][^"']*\bltx_document\b/i.test(html);
}

/**
 * AR-02：ar5iv 没有可用转换时（例如 hep-th/9711200）仍返回 200 和 ltx_document，
 * 但标题是「No content available」、正文只有一个空 article 加上 ltx_ERROR 的 Fatal error 提示。
 * 这种页面不算可转换，交给 PDF 兜底。
 */
export function isNoContentPage(html) {
  if (typeof html !== 'string') return true;
  if (/<title>\s*No content available\s*<\/title>/i.test(html)) return true;
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const docs = body.match(/<article\b[^>]*\bltx_document\b[^>]*>[\s\S]*?<\/article>/gi) || [];
  const text = docs.join(' ')
    .replace(/<span\b[^>]*\bltx_ERROR\b[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|\s+/g, '');
  return text.length === 0;
}

export function isUsableHtmlPaper({ ok, finalUrl, contentType, html }) {
  return isAr5ivHtmlAvailable({ ok, finalUrl, contentType }) && hasLtxDocument(html) && !isNoContentPage(html);
}

/**
 * AR-02：转换结果除去 YAML 头、标题行、元数据引用块和分隔线后没有正文，就不算成功，绝不显示「转换完成」。
 */
export function hasMarkdownBody(markdown) {
  if (typeof markdown !== 'string') return false;
  const rest = markdown
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .split('\n')
    .filter((l) => !/^\s*(#{1,6}\s|>|[-*_]{3,}\s*$)/.test(l))
    .join('')
    .replace(/Conversion to HTML had a Fatal error and exited abruptly\.?( This document may be truncated or damaged\.)?/g, '')
    .replace(/\s+/g, '');
  return rest.length > 0;
}

export async function loadHtmlPaper(source, arxivId, fetchImpl = fetch, onError = null) {
  const url = `${source.base}/${arxivId}`;
  try {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'follow' });
    const finalUrl = response.url || url;
    const contentType = response.headers?.get?.('content-type') || '';
    const html = typeof response.text === 'function' ? await response.text() : '';
    const usable = isUsableHtmlPaper({
      ok: response.ok,
      finalUrl,
      contentType,
      html,
    });
    logger.debug(
      `HTML source ${source.id}: ${arxivId} -> ${usable}, status ${response.status}, url: ${finalUrl}`,
    );
    if (!usable) return null;
    return {
      source: source.id,
      label: source.label,
      url,
      finalUrl,
      html,
    };
  } catch (error) {
    logger.warn(`HTML source ${source.id} failed for ${arxivId}:`, error);
    if (onError) onError(error);
    return null;
  }
}

/**
 * Try official arXiv HTML, then ar5iv.
 * `tier: 'pdf'` means neither source has a convertible paper.
 */
export async function selectConversionSource(arxivId, fetchImpl = fetch) {
  for (const source of HTML_PAPER_SOURCES) {
    const paper = await loadHtmlPaper(source, arxivId, fetchImpl);
    if (paper) return { tier: source.id, paper };
  }
  return { tier: PDF_TIER, paper: null };
}
