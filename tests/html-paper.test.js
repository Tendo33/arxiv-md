import { API } from '../src/config/constants';
import { selectConversionSource } from '../src/core/html-paper';
import converter from '../src/core/converter/ar5iv-converter';

const ARXIV_ID = '1706.03762';
const OFFICIAL_URL = `${API.ARXIV_HTML_BASE}/${ARXIV_ID}`;
const AR5IV_URL = `${API.AR5IV_BASE}/${ARXIV_ID}`;
const PAPER_HTML = '<article class="ltx_document"><h1 class="ltx_title ltx_title_document">Attention</h1></article>';

function responseFor(route) {
  return {
    ok: route.ok !== false,
    status: route.status || (route.ok === false ? 404 : 200),
    url: route.finalUrl,
    headers: { get: () => route.contentType ?? 'text/html; charset=utf-8' },
    text: async () => route.html ?? '',
  };
}

function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const route = routes[url];
    if (!route) throw new Error(`unexpected ${url}`);
    if (route.error) throw route.error;
    return responseFor({ ...route, finalUrl: route.finalUrl || url });
  };
  return { fetchImpl, calls };
}

describe('selectConversionSource', () => {
  test('uses official arXiv HTML and does not request ar5iv', async () => {
    const { fetchImpl, calls } = mockFetch({
      [OFFICIAL_URL]: { html: PAPER_HTML },
      [AR5IV_URL]: { html: PAPER_HTML },
    });

    const selected = await selectConversionSource(ARXIV_ID, fetchImpl);

    expect(selected.tier).toBe('arxiv-html');
    expect(selected.paper.finalUrl).toBe(OFFICIAL_URL);
    expect(selected.paper.html).toContain('ltx_document');
    expect(calls).toEqual([OFFICIAL_URL]);
  });

  test('falls through to ar5iv when official HTML redirects to the abstract', async () => {
    const { fetchImpl, calls } = mockFetch({
      [OFFICIAL_URL]: {
        finalUrl: `https://arxiv.org/abs/${ARXIV_ID}`,
        html: '<html><body>Abstract</body></html>',
      },
      [AR5IV_URL]: { html: PAPER_HTML },
    });

    const selected = await selectConversionSource(ARXIV_ID, fetchImpl);

    expect(selected.tier).toBe('ar5iv');
    expect(selected.paper.source).toBe('ar5iv');
    expect(calls).toEqual([OFFICIAL_URL, AR5IV_URL]);
  });

  test('falls through to ar5iv when official HTML has no article', async () => {
    const { fetchImpl } = mockFetch({
      [OFFICIAL_URL]: { html: '<html><body><p>Conversion failed</p></body></html>' },
      [AR5IV_URL]: { html: PAPER_HTML },
    });

    const selected = await selectConversionSource(ARXIV_ID, fetchImpl);

    expect(selected.tier).toBe('ar5iv');
  });

  test('chooses PDF when official HTML and ar5iv are both unavailable', async () => {
    const { fetchImpl, calls } = mockFetch({
      [OFFICIAL_URL]: {
        finalUrl: `https://arxiv.org/abs/${ARXIV_ID}`,
        html: PAPER_HTML,
      },
      [AR5IV_URL]: { ok: false, status: 404, html: '' },
    });

    const selected = await selectConversionSource(ARXIV_ID, fetchImpl);

    expect(selected).toEqual({ tier: 'pdf', paper: null });
    expect(calls).toEqual([OFFICIAL_URL, AR5IV_URL]);
  });

  test('continues after a network error on the official page', async () => {
    const { fetchImpl } = mockFetch({
      [OFFICIAL_URL]: { error: new Error('offline') },
      [AR5IV_URL]: { html: PAPER_HTML },
    });

    const selected = await selectConversionSource(ARXIV_ID, fetchImpl);

    expect(selected.tier).toBe('ar5iv');
  });
});

describe('HTML paper frontmatter', () => {
  test('collapses a title broken by a line break', () => {
    const html = `<article class="ltx_document">
      <h1 class="ltx_title ltx_title_document">Predicting Alignment Generalization
        <br class="ltx_break">With Value Representations</h1>
    </article>`;

    expect(converter.cleanHtml(html).title).toBe(
      'Predicting Alignment Generalization With Value Representations',
    );
  });

  test('keeps a space when a title break has no surrounding whitespace', () => {
    const html = '<article class="ltx_document"><h1 class="ltx_title ltx_title_document">Alignment<br class="ltx_break">Generalization</h1></article>';

    expect(converter.cleanHtml(html).title).toBe('Alignment Generalization');
  });

  test('writes a multiline title as one valid YAML string', () => {
    const markdown = converter._addMetadata('Body', {
      title: 'Predicting Alignment Generalization \nWith "Value" Representations: A\\B',
      arxivId: '2610.12410',
      source: 'arxiv-html',
      authors: ['Ada: Lovelace'],
      year: '2026',
    });

    expect(markdown).toContain(
      'title: "Predicting Alignment Generalization \\nWith \\"Value\\" Representations: A\\\\B"',
    );
    expect(markdown).toContain('source: arxiv-html');
    expect(markdown).toContain('authors: "Ada: Lovelace"');
    expect(markdown.split('\n').filter((line) => line.startsWith('title:'))).toHaveLength(1);
  });
});
