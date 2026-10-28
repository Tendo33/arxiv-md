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

export function isUsableHtmlPaper({ ok, finalUrl, contentType, html }) {
  return isAr5ivHtmlAvailable({ ok, finalUrl, contentType }) && hasLtxDocument(html);
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
