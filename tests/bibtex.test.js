import { buildArxivBibtex, chooseBibtex, paperTabTitle } from '../src/content/bibtex';

describe('BibTeX and tab title', () => {
  test('builds a citeable record and escapes BibTeX special characters', () => {
    const bib = buildArxivBibtex({
      arxivId: '1706.03762v1',
      title: 'Attention & More_100%',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
      year: 2017,
    });
    expect(bib).toContain('@misc{arxiv170603762,');
    expect(bib).toContain('title={Attention \\& More\\_100\\%},');
    expect(bib).toContain('author={Ashish Vaswani and Noam Shazeer},');
    expect(bib).toContain('eprint={1706.03762},');
    expect(bib).toContain('url={https://arxiv.org/abs/1706.03762},');
    const slash = buildArxivBibtex({ arxivId: '1', title: 'A \\alpha' });
    expect(slash).toContain('title={A \\textbackslash{}alpha},');
    expect(slash).not.toContain('\\textbackslash\\{\\}');
  });

  test('keeps an official BibTeX body and falls back otherwise', () => {
    const fallback = buildArxivBibtex({ arxivId: '1706.03762', title: 'Local' });
    expect(chooseBibtex('@misc{official,\n}\n', fallback)).toContain('@misc{official,');
    expect(chooseBibtex('not found', fallback)).toBe(fallback);
  });

  test('uses the paper title for the browser tab', () => {
    expect(paperTabTitle('Title: Attention Is All You Need')).toBe('Attention Is All You Need');
    expect(paperTabTitle('   ')).toBeNull();
  });
});
