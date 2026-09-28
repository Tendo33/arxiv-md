import { isAr5ivHtmlAvailable } from '../src/core/ar5iv-availability';

describe('isAr5ivHtmlAvailable', () => {
  test('accepts an HTML document that stayed on the html path', () => {
    expect(isAr5ivHtmlAvailable({
      ok: true,
      finalUrl: 'https://ar5iv.labs.arxiv.org/html/1706.03762',
      contentType: 'text/html; charset=utf-8',
    })).toBe(true);
  });

  test('accepts a missing content type', () => {
    expect(isAr5ivHtmlAvailable({
      ok: true,
      finalUrl: 'https://ar5iv.labs.arxiv.org/html/1706.03762',
      contentType: '',
    })).toBe(true);
  });

  test('rejects redirects back to an abstract page, error statuses, and non-html bodies', () => {
    expect(isAr5ivHtmlAvailable({
      ok: true,
      finalUrl: 'https://arxiv.org/abs/1706.03762',
      contentType: 'text/html',
    })).toBe(false);
    expect(isAr5ivHtmlAvailable({
      ok: false,
      finalUrl: 'https://ar5iv.labs.arxiv.org/html/1706.03762',
      contentType: 'text/html',
    })).toBe(false);
    expect(isAr5ivHtmlAvailable({
      ok: true,
      finalUrl: 'https://ar5iv.labs.arxiv.org/html/1706.03762',
      contentType: 'application/pdf',
    })).toBe(false);
  });
});
