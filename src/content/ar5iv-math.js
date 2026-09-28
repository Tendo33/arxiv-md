import logger from '@utils/logger';

export function isBlockFormula(mathEl, latex) {
  // 1. 显式 display="block" 属性
  const displayAttr = mathEl.getAttribute('display');
  if (displayAttr === 'block') return true;

  // 2. 在方程式容器中（ar5iv 特有的 class）
  const equationContainer = mathEl.closest(
    '.ltx_equation, .ltx_equationgroup, .ltx_eqn_table, .ltx_eqn_row',
  );
  if (equationContainer) return true;

  // 3. LaTeX 内容包含 \displaystyle 命令（说明原本是块级公式）
  if (latex.includes('\\displaystyle')) return true;

  // 4. LaTeX 内容是多行公式（包含 \\ 换行或 aligned/array 环境）
  if (
    latex.includes('\\\\') ||
    latex.includes('\\begin{aligned}') ||
    latex.includes('\\begin{array}') ||
    latex.includes('\\begin{cases}')
  ) {
    return true;
  }

  // 5. 在独立段落中（父元素是 p 或 div，且只有这一个 math 子元素，无其他有效内容）
  const parent = mathEl.parentElement;
  if (parent && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
    // 检查 childNodes（包括文本节点），确认除了 math 元素外只有空白文本
    const hasOnlyMathContent = Array.from(parent.childNodes).every((node) => {
      if (node === mathEl) return true;
      if (node.nodeType === Node.TEXT_NODE) {
        // 只允许空白文本节点
        return !node.textContent.trim();
      }
      // 其他元素节点不允许
      return false;
    });
    if (hasOnlyMathContent) {
      return true;
    }
  }

  return false;
}

/**
 * 预处理：提取并替换所有数学公式元素
 */
export function preprocessMathElements(doc) {
  const mathMap = new Map();
  let mathCounter = 0;

  const createPlaceholder = (id, isBlock) => {
    return isBlock
      ? `MATHBLOCKSTART${id}MATHBLOCKEND`
      : `MATHINLINESTART${id}MATHINLINEEND`;
  };

  // 处理所有 <math> 标签
  doc.querySelectorAll('math').forEach((mathEl) => {
    const alttext = mathEl.getAttribute('alttext');

    if (alttext) {
      let latex = alttext.trim();
      const isBlock = isBlockFormula(mathEl, latex);

      if (isBlock && latex.startsWith('\\displaystyle')) {
        latex = latex.replace(/^\\displaystyle\s*/, '');
      }

      const placeholder = createPlaceholder(mathCounter, isBlock);
      mathMap.set(placeholder, { latex, isBlock });
      mathCounter++;
      mathEl.replaceWith(doc.createTextNode(placeholder));
    } else {
      const annotation = mathEl.querySelector(
        'annotation[encoding="application/x-tex"]',
      );
      if (annotation && annotation.textContent) {
        let latex = annotation.textContent.trim();
        const isBlock = isBlockFormula(mathEl, latex);

        if (isBlock && latex.startsWith('\\displaystyle')) {
          latex = latex.replace(/^\\displaystyle\s*/, '');
        }

        const placeholder = createPlaceholder(mathCounter, isBlock);
        mathMap.set(placeholder, { latex, isBlock });
        mathCounter++;
        mathEl.replaceWith(doc.createTextNode(placeholder));
      } else {
        // 兜底处理：尝试提取 MathML 的文本内容
        const textContent = mathEl.textContent.trim();
        if (textContent) {
          // 将纯文本作为行内公式处理（可能是变量名或简单表达式）
          const placeholder = createPlaceholder(mathCounter, false);
          mathMap.set(placeholder, { latex: textContent, isBlock: false });
          mathCounter++;
          mathEl.replaceWith(doc.createTextNode(placeholder));
          logger.warn('Math element without LaTeX source, using text content:', textContent.substring(0, 50));
        } else {
          mathEl.remove();
        }
      }
    }
  });

  // 清理残留的 MathML 标签
  const mathMLTags = [
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msub',
    'msup',
    'mfrac',
    'msqrt',
    'mtext',
    'annotation-xml',
    'annotation',
    'apply',
    'csymbol',
    'ci',
    'cn',
  ];
  mathMLTags.forEach((tag) =>
    doc.querySelectorAll(tag).forEach((el) => el.remove()),
  );

  logger.debug(`Extracted ${mathCounter} math formulas`);
  return { doc, mathMap };
}
/**
 * 移除所有 MathML 相关元素
 */
export function removeMathMLArtifacts(doc) {
  const mathMLSelectors = [
    'math',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msub',
    'msup',
    'mfrac',
    'msqrt',
    'mtext',
    'annotation-xml',
    'annotation',
  ];

  mathMLSelectors.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((el) => {
      if (el.textContent && !el.querySelector('annotation')) {
        const text = el.textContent.trim();
        text ? el.replaceWith(doc.createTextNode(text)) : el.remove();
      } else {
        el.remove();
      }
    });
  });
}

/**
 * 清理 LaTeX 公式中不支持的命令（颜色、字体大小等）
 */
export function cleanLatexFormula(latex) {
  let result = latex;

  // 1. 移除颜色定义命令 \definecolor[named]{...}{...}{...} 或 \definecolor{...}{...}{...}
  result = result.replace(
    /\\definecolor\s*(?:\[[^\]]*\])?\s*\{[^}]*\}\s*\{[^}]*\}(?:\s*\{[^}]*\})?/g,
    '',
  );

  // 2. 移除 \color[rgb]{...} 或 \color{...} 命令（保留后续内容）
  result = result.replace(/\\color\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, '');

  // 3. 移除 \textcolor{...}{content} - 保留 content（处理嵌套大括号）
  result = result.replace(
    /\\textcolor\s*\{[^}]*\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    '$1',
  );

  // 4. 移除 pgf 相关颜色命令
  result = result.replace(/\\pgfstrokecolor/g, '');
  result = result.replace(/\\pgfsetcolor\s*\{[^}]*\}/g, '');
  result = result.replace(/\\pgfsetfillcolor\s*\{[^}]*\}/g, '');

  // 5. 移除字体大小命令
  const fontSizeCommands = [
    '\\footnotesize',
    '\\scriptsize',
    '\\tiny',
    '\\small',
    '\\normalsize',
    '\\large',
    '\\Large',
    '\\LARGE',
    '\\huge',
    '\\Huge',
    '\\bigskip',
    '\\medskip',
    '\\smallskip',
  ];
  fontSizeCommands.forEach((cmd) => {
    result = result.replace(
      new RegExp(
        cmd.replace(/\\/g, '\\\\') + '(?:\\s+|(?=\\\\)|(?=[^a-zA-Z]))',
        'g',
      ),
      '',
    );
  });

  // 6. 移除其他不常见的格式命令
  result = result.replace(/\\mbox\s*\{([^}]*)\}/g, '$1'); // \mbox{text} -> text
  result = result.replace(/\\text\s*\{([^}]*)\}/g, '\\text{$1}'); // 保留 \text

  // 7. 清理多余空格和空大括号
  result = result.replace(/\{\s*\}/g, ''); // 移除空大括号 {}
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * 恢复数学公式占位符
 */
export function restoreMathPlaceholders(markdown, mathMap) {
  let result = markdown;

  mathMap.forEach((value, placeholder) => {
    let { latex, isBlock } = value;

    // 清理 LaTeX 中不支持的命令
    latex = cleanLatexFormula(latex);

    const escapedPlaceholder = placeholder.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    const regex = new RegExp(escapedPlaceholder, 'g');

    // Function replacers keep literal dollars. A string replacer treats $$ as one $.
    const rendered = isBlock ? `$$${latex.trim()}$$` : `$${latex.trim()}$`;
    result = result.replace(regex, () => rendered);
  });

  return result;
}
