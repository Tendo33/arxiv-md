// front-matter：沿用 arxiv-md 现有字段（title / arxiv_id / source / authors / year），与 ar5iv-converter 输出一致
export function escapeYaml(str) {
  if (str == null) return '""';
  const v = String(str);
  if (/[:#[\]{}&*!|>'"%@`]/.test(v) || /[\n\r\t]/.test(v) || v.trim() !== v) {
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r\n|\r|\n/g, '\\n').replace(/\t/g, '\\t')}"`;
  }
  return v;
}

export function buildFrontMatter(meta = {}) {
  const lines = ['---', `title: ${escapeYaml(meta.title)}`];
  if (meta.arxivId) lines.push(`arxiv_id: ${meta.arxivId}`);
  if (meta.source) lines.push(`source: ${meta.source}`);
  const authors = Array.isArray(meta.authors) ? meta.authors.filter(Boolean).join(', ') : '';
  if (authors) lines.push(`authors: ${escapeYaml(authors)}`);
  if (meta.year) lines.push(`year: ${meta.year}`);
  lines.push('---', '');
  return lines.join('\n');
}

export function addFrontMatter(md, meta) {
  if (!meta) return md;
  return `${buildFrontMatter(meta)}\n${String(md).replace(/^\uFEFF?---\n[\s\S]*?\n---\n/, '')}`;
}
