export const DEFAULT_ASSET_PAGE_URL = 'https://ar5iv.labs.arxiv.org/html/1706.03762';

/**
 * Resolve a paper image against the HTML page it came from.
 * Root-relative ar5iv paths stay on that host. Official HTML uses paths like
 * `1706.03762v7/Figures/fig.png`, which replace the last segment of the page URL.
 */
export function resolvePaperAssetUrl(src, pageUrl = DEFAULT_ASSET_PAGE_URL) {
  if (!src) return '';
  const stripped = String(src).trim().replace(/chrome-extension:\/\/[^/]+\//, '');
  if (!stripped || stripped.startsWith('data:')) return stripped;
  try {
    return new URL(stripped, pageUrl).href;
  } catch {
    return stripped;
  }
}
