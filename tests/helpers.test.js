import { extractArxivId, generateFilename, sanitizeFilename } from '../src/utils/helpers';

describe('extractArxivId', () => {
  test('reads a bare modern id and strips nothing when there is no version', () => {
    expect(extractArxivId('1706.03762')).toBe('1706.03762');
  });

  test('reads abs and pdf urls, including a version suffix', () => {
    expect(extractArxivId('https://arxiv.org/abs/1706.03762v1')).toBe('1706.03762v1');
    expect(extractArxivId('https://arxiv.org/pdf/1706.03762.pdf')).toBe('1706.03762');
  });

  test('reads a legacy category id', () => {
    expect(extractArxivId('cs/0101001')).toBe('cs/0101001');
    expect(extractArxivId('https://arxiv.org/abs/cs/0101001')).toBe('cs/0101001');
  });

  test('rejects non-strings and unrelated text', () => {
    expect(extractArxivId(null)).toBeNull();
    expect(extractArxivId('not a paper')).toBeNull();
  });
});

describe('filenames', () => {
  test('drops control characters and reserved path characters', () => {
    expect(sanitizeFilename('a\u0001b<c>:d')).toBe('abcd');
  });

  test('uses the title and year, and falls back to the arXiv id', () => {
    expect(generateFilename({ title: 'Attention', year: 2017, arxivId: '1706.03762' })).toBe('Attention (2017).md');
    expect(generateFilename({ title: '   ', arxivId: '1706.03762' }, 'pdf')).toBe('arxiv_1706.03762.pdf');
  });
});
