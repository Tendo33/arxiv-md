/**
 * Decide whether an HTML-paper response stayed on an HTML document.
 * Applies to arXiv HTML and ar5iv. A redirect back to /abs/ is not usable.
 */
export function isAr5ivHtmlAvailable({ ok, finalUrl, contentType }) {
  const url = finalUrl || '';
  const type = contentType || '';
  return Boolean(ok) && !/\/abs\//i.test(url) && (!type || /text\/html/i.test(type));
}
