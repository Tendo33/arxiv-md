/**
 * AF3-01 完整性保护：对比页面里的章节/正文量和导出的 Markdown，
 * 明显偏少时标记为「可能不完整」（仍然下载，徽标和提示改为警告）。
 * 设计与阈值见 dev-log-af3-2026-10-28.md。
 */

// 只算 section / subsection / appendix 三级标题；paragraph 级标题在 LaTeXML 里经常只是加粗行
const SOURCE_HEADING_SELECTOR =
  '.ltx_title_section, .ltx_title_subsection, .ltx_title_appendix';

// 低于这些比例就判定可能不完整（正常页实测：标题 ≥ 1.0，正文 ≥ 0.9；截断页：0.3 左右）
export const INTEGRITY_THRESHOLDS = { headings: 0.8, text: 0.6 };
// 页面太短时比例不稳定，不做判断
const MIN_SOURCE_HEADINGS = 3;
const MIN_SOURCE_CHARS = 2000;

function nonSpaceLength(text) {
  return (text || '').replace(/\s+/g, '').length;
}

/** 统计页面：章节标题数 + 正文段落（.ltx_para 最外层，去掉公式）非空白字符数 */
export function measureSource(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  const headings = doc.querySelectorAll(SOURCE_HEADING_SELECTOR).length;
  let chars = 0;
  doc.querySelectorAll('.ltx_para').forEach((para) => {
    const parent = para.parentElement;
    if (parent && parent.closest && parent.closest('.ltx_para')) return;
    const clone = para.cloneNode(true);
    clone.querySelectorAll('math, .ltx_Math, .ltx_equation, .ltx_note').forEach((m) => m.remove());
    chars += nonSpaceLength(clone.textContent);
  });
  return { headings, chars };
}

/** 统计导出：## / ### 标题数 + 去掉 front matter、代码块、公式、链接地址后的非空白字符数 */
export function measureMarkdown(markdown) {
  const text = String(markdown || '')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, ' ');
  const headings = (text.match(/^#{2,3}\s+\S/gm) || []).length;
  const prose = text
    .replace(/\$\$[\s\S]+?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/[#*_>|`[\]-]/g, '');
  return { headings, chars: nonSpaceLength(prose) };
}

/**
 * 返回 { complete, source, exported, ratios }。
 * source 缺失或页面太短时 complete 恒为 true（宁可漏报，也不误报）。
 */
export function assessIntegrity(source, exported, thresholds = INTEGRITY_THRESHOLDS) {
  const result = { complete: true, source, exported, ratios: null };
  if (!source || !exported) return result;
  const headingRatio = source.headings > 0 ? exported.headings / source.headings : 1;
  const textRatio = source.chars > 0 ? exported.chars / source.chars : 1;
  result.ratios = { headings: headingRatio, text: textRatio };
  const headingsShort = source.headings >= MIN_SOURCE_HEADINGS && headingRatio < thresholds.headings;
  const textShort = source.chars >= MIN_SOURCE_CHARS && textRatio < thresholds.text;
  result.complete = !(headingsShort || textShort);
  return result;
}
