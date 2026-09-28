function escapeBibtex(value) {
  return String(value || '')
    .replace(/\\/g, '@@BS@@')
    .replace(/([&%$#_{}])/g, '\\$1')
    .split('@@BS@@').join('\\textbackslash{}')
    .replace(/\s+/g, ' ')
    .trim();
}

function citationKey(arxivId) {
  const bare = String(arxivId || 'paper').replace(/v\d+$/i, '');
  return `arxiv${bare.replace(/[^\w]/g, '')}`;
}

/**
 * BibTeX built from the abstract page when arXiv's /bibtex endpoint is unavailable.
 * The official response is preferred by chooseBibtex().
 */
export function buildArxivBibtex({ arxivId, title, authors, year }) {
  const id = String(arxivId || '').replace(/v\d+$/i, '');
  const author = (authors || []).filter(Boolean).join(' and ');
  const lines = [
    `@misc{${citationKey(id)},`,
    `  title={${escapeBibtex(title || id)}},`,
  ];
  if (author) lines.push(`  author={${escapeBibtex(author)}},`);
  if (year) lines.push(`  year={${year}},`);
  if (id) {
    lines.push(`  eprint={${id}},`);
    lines.push('  archivePrefix={arXiv},');
    lines.push(`  url={https://arxiv.org/abs/${id}},`);
  }
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export function chooseBibtex(officialText, fallback) {
  const text = String(officialText || '').trim();
  if (text.startsWith('@')) return text.endsWith('\n') ? text : `${text}\n`;
  return fallback;
}

export function paperTabTitle(title) {
  const cleaned = String(title || '').replace(/^Title:\s*/i, '').trim();
  return cleaned || null;
}
