export function postProcessMarkdown(markdown) {
  let result = markdown;

  // 恢复被转义的引用方括号
  result = result.replace(/\\\[(\d+(?:\s*,\s*\d+)*)\\\]/g, '[$1]');

  // 修复章节标题格式
  result = result.replace(
    /^\s*\((\d+(?:\.\d+)*)\)\s+(.+)$/gm,
    (match, num, title) => {
      const level = num.split('.').length + 1;
      return `${'#'.repeat(Math.min(level, 6))} ${num} ${title}`;
    },
  );

  // 修复列表项格式
  result = result.replace(/-\s+\(•\)\s*\n\n\s+/g, '- ');
  result = result.replace(/-\s+\(•\)\s*/g, '- ');
  result = result.replace(/-\s+•\s*/g, '- ');

  // 清理重复的数学表达式
  result = result
    .replace(/([a-zA-Z]+)([\u{1D400}-\u{1D7FF}]+)\1\{([^}]+)\}/gu, '$$1_{$3}$')
    .replace(
      /([a-zA-Z]+)([\u{1D400}-\u{1D7FF}]+)\1\^\{([^}]+)\}/gu,
      '$$1^{$3}$',
    );

  // 移除孤立的 Unicode 数学符号
  result = result.replace(/([a-zA-Z])([\u{1D400}-\u{1D7FF}]+)(\d)/gu, '$1$3');

  // 清理脚标文本和脚注标记
  result = result
    .replace(/\bsubscript\b/gi, '')
    .replace(/\bsuperscript\b/gi, '');
  result = result
    .replace(/\d+footnotemark:\s*\d+/g, '')
    .replace(/footnotemark:\s*/g, '');

  // 清理重复的项目符号
  result = result.replace(/^(\s*-\s*)•\s*/gm, '$1');

  // 修复表格和空格
  result = result.replace(/\|\s*\|\s*\|/g, '| |');
  result = result.replace(/[ \t]+$/gm, '');

  // 移除 HTML 实体残留
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  // 清理 LaTeX 命令残留
  result = result.replace(/\\\\AND/g, '').replace(/\\AND/g, '');

  // 修复连续的行内公式
  result = result.replace(
    /\$\$([^$]+)\$\$/g,
    'DOUBLEDOLLARSTART$1DOUBLEDOLLAREND',
  );
  result = result.replace(/\$([^$]+)\$\$([^$]+)\$/g, '$$$1$ $$$2$');
  result = result.replace(
    /DOUBLEDOLLARSTART([^]*?)DOUBLEDOLLAREND/g,
    (_, content) => `\n\n$$\n${content.trim()}\n$$\n\n`,
  );

  // 清理多余空行和非表格 HTML 标签残留
  // 只移除常见的非表格 HTML 标签，保留表格相关标签
  // 使用明确的标签名称列表避免误删 LaTeX 中的 < 符号
  result = result.replace(/\n{4,}/g, '\n\n\n');
  const nonTableTags = ['span', 'div', 'p', 'a', 'b', 'i', 'u', 's', 'em', 'strong',
    'font', 'br', 'hr', 'img', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
    'section', 'article', 'nav', 'aside', 'header', 'footer', 'main',
    'figure', 'figcaption', 'sup', 'sub', 'mark', 'small', 'big',
    'center', 'cite', 'q', 'abbr', 'address', 'time', 'label', 'input',
    'button', 'select', 'option', 'textarea', 'form', 'fieldset', 'legend'];
  const tagPattern = new RegExp(`<\\/?(?:${nonTableTags.join('|')})[^>]*>`, 'gi');
  result = result.replace(tagPattern, '');

  return result;
}
