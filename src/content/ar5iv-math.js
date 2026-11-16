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

  // 6a. 通用性修补：Springer/ar5iv 常见的 bm 宏在 MathJax（Obsidian、GitHub）里默认不存在，
  // 整条公式会因此报错；\boldsymbol 在 TeX、KaTeX、MathJax 里都可用。
  result = result.replace(/\\bm(?![a-zA-Z])/g, '\\boldsymbol');

  // 6b. KaTeX 不支持的文本命令 / 交叉引用
  result = result.replace(/\\textsc\b/g, '\\text');
  result = result.replace(/\\textnormal(?![a-zA-Z])/g, '\\text');
  // \text{…} 里的数学命令（\text{\diag}、\text{\bm{x}}、\text{3\times 3}）在 text 模式下非法，
  // KaTeX 会整条报错。用平衡大括号扫描处理（正则处理不了嵌套的 {}），
  // 只剥命令外壳保留内容；含 $…$ 的文本组留给 6c 的 splitDollarsInTextGroups。
  result = mapTextGroups(result, cleanTextGroupContent);
  // argmax/argmin 习惯用 \DeclareMathOperator*（下标在正下方）；前面是奇数个 \ 才是命令，\\diag 是换行 + 字母
  result = result.replace(/(?<=(?:^|[^\\])(?:\\\\)*)\\(argmax|argmin)(?![a-zA-Z])/g, '\\operatorname*{$1}');
  result = result.replace(/(?<=(?:^|[^\\])(?:\\\\)*)\\(diag|Tr|tr|rank|sign|sgn)(?![a-zA-Z])/g, '\\operatorname{$1}');
  result = result.replace(/~?\\(?:eqref|ref|autoref|cref|Cref|label)\s*\{[^}]*\}/g, '');

  // LaTeXML 输出的 \\begin{array}[]{c} 空可选参数 KaTeX 不认
  result = result.replace(/\\begin\{(array|tabular)\}\s*\[\s*\]/g, '\\begin{$1}');

  // 6c. \text{3$\times$3} 这类文本组里的行内 $...$ 会破坏 Markdown 公式定界符，拆成 }…\text{
  result = splitDollarsInTextGroups(result);
  result = result.replace(/\\text(?:rm|bf|it|tt|sf)?\s*\{\s*\}/g, '');

  // 7. 清理多余空格和空大括号
  result = result.replace(/\{\s*\}/g, ''); // 移除空大括号 {}
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * 恢复数学公式占位符
 */
export function restoreMathPlaceholders(markdown, mathMap) {
  if (!mathMap || mathMap.size === 0) return markdown;
  // 单次扫描：一条正则匹配全部占位符再查表，替代逐个 new RegExp 全文替换（O(N·L) → O(L)）
  const rendered = new Map();
  return markdown.replace(
    /MATH(BLOCK|INLINE)START\d+MATH\1END/g,
    (ph) => {
      if (rendered.has(ph)) return rendered.get(ph);
      const value = mathMap.get(ph);
      if (!value) return ph;
      const latex = cleanLatexFormula(value.latex).trim();
      // 函数替换保留字面 $，字符串替换会把 $$ 当成一个 $
      const out = value.isBlock ? `$$${latex}$$` : `$${latex}$`;
      rendered.set(ph, out);
      return out;
    },
  );
}

const TEXT_GROUP_RE = /\\(?:text|textrm|textbf|textit|texttt|textsf|mbox)\s*\{/g;

const TEXT_SYMBOLS = {
  times: '×',
  cdot: '·',
  pm: '±',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  approx: '≈',
  to: '→',
  rightarrow: '→',
  prime: '′',
  infty: '∞',
};

/**
 * 用平衡大括号扫描遍历 \text{…} / \mbox{…} 组，对组内容调用 fn。
 * 正则处理不了嵌套的 {}（\text{\bm{x}}），这里按深度配对。
 */
function mapTextGroups(latex, fn) {
  let out = '';
  let last = 0;
  TEXT_GROUP_RE.lastIndex = 0;
  let match;
  while ((match = TEXT_GROUP_RE.exec(latex))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    for (; i < latex.length && depth > 0; i += 1) {
      if (latex[i] === '\\') { i += 1; continue; }
      if (latex[i] === '{') depth += 1;
      else if (latex[i] === '}') depth -= 1;
    }
    if (depth !== 0) break;
    const body = latex.slice(start, i - 1);
    const cmd = match[0].slice(0, match[0].length - 1).trim();
    out += latex.slice(last, match.index) + cmd + '{' + fn(body) + '}';
    last = i;
    TEXT_GROUP_RE.lastIndex = i;
  }
  return out + latex.slice(last);
}

/**
 * 文本组里不能出现数学命令（KaTeX: "Can't use function ... in text mode"）。
 * 剥掉命令外壳保留内容：\bm{x} → x，\diag → diag，\times → ×。
 * 含 $…$ 的组原样返回，交给 6c 的 splitDollarsInTextGroups 拆分。
 */
function cleanTextGroupContent(inner) {
  if (inner.includes('$')) return inner;
  let out = inner;
  // 字体/数学字体命令可以嵌套，循环剥到不再变化为止（\bm{\bm{x}}）
  const fontCmd = /\\(?:bm|boldsymbol|mathbf|mathbb|mathcal|mathrm|mathit|mathsf|mathtt|mathfrak|boxed)\s*\{([^{}]*)\}/;
  for (let guard = 0; guard < 8 && fontCmd.test(out); guard += 1) {
    out = out.replace(new RegExp(fontCmd.source, 'g'), '$1');
  }
  return out.replace(/\\([a-zA-Z]+)(?![a-zA-Z])\s*/g, (m, name) => {
    if (TEXT_SYMBOLS[name]) return TEXT_SYMBOLS[name];
    // \textbf{…} / \mbox{…} 这类文本命令在 text 模式下合法，保留命令本身
    if (TEXT_FONT_CMDS.has(name)) return `\\${name}`;
    // 其余数学命令（\diag、\argmax…）在 text 模式下非法，只留名字
    return name;
  });
}

const TEXT_FONT_CMDS = new Set([
  'text', 'textrm', 'textbf', 'textit', 'texttt', 'textsf', 'textsc', 'textnormal', 'mbox',
]);

function splitDollarsInTextGroups(latex) {
  if (!latex.includes('$')) return latex;
  let out = '';
  let last = 0;
  TEXT_GROUP_RE.lastIndex = 0;
  let match;
  while ((match = TEXT_GROUP_RE.exec(latex))) {
    const cmd = match[0].replace(/\s*\{$/, '');
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    for (; i < latex.length && depth > 0; i += 1) {
      if (latex[i] === '\\') { i += 1; continue; }
      if (latex[i] === '{') depth += 1;
      else if (latex[i] === '}') depth -= 1;
    }
    if (depth !== 0) break;
    const body = latex.slice(start, i - 1);
    const fixed = body.replace(/\$([^$]*)\$/g, (_, m) => `}${m}${cmd}{`);
    out += latex.slice(last, start) + fixed + '}';
    last = i;
    TEXT_GROUP_RE.lastIndex = i;
  }
  return out + latex.slice(last);
}
