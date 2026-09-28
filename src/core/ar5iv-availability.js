/**
 * Decide whether an ar5iv response is usable HTML.
 * HEAD is sometimes rejected; callers may retry with GET and pass that response here.
 */
export function isAr5ivHtmlAvailable({ ok, finalUrl, contentType }) {
  const url = finalUrl || '';
  const type = contentType || '';
  return Boolean(ok) && !/\/abs\//i.test(url) && (!type || /text\/html/i.test(type));
}
