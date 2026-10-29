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
  // AB6-01：标签名后必须是空白、/ 或 >，`<EMAIL>`/`<PASSWORD>`/`<P|N>`/`<String>` 不再被当成 em/p/s 吃掉；
  // 代码块、行内代码、公式整体跳过，原样保留。
  const tagPattern = new RegExp(`<\\/?(?:${nonTableTags.join('|')})(?=[\\s/>])[^>]*>`, 'gi');
  result = replaceOutsideProtected(result, (text) => text.replace(tagPattern, ''));

  return result;
}

// AB6-01：围栏代码块（``` / ~~~~）、$$…$$、行内代码、$…$ 不参与标签清理。
// batch8（batch7 审查 P3-2）：改为单遍扫描，不再用一个大正则：
// - 行内代码按 CommonMark 规则：开头 n 个反引号的串，只和同一行里下一个「正好 n 个」的串闭合；
//   没有配对的反引号串按普通文本处理。每行先把反引号串按长度分组，查找是 O(1) 摊还，整体线性。
// - $…$（Pandoc tex_math_dollars 规则）：开头 $ 后不能是空白，结尾 $ 前不能是空白、后不能紧跟数字；同一行内配对。
//   货币 $5 … $10 / $5,$10 不算公式。没有采用「开头 $ 后不能是数字」：它会让 $0$、$0.25$ 这类真公式失去保护（2305.18290 快照）。
// - 围栏代码块：行首 ```/~~~（≥3），到同一串独占一行（可带尾随空白）为止；没闭合就不保护（与旧行为一致）。
// - $$…$$：到下一个 $$ 为止；没闭合就不保护。
// batch9 ③（batch8 审查 P3③）：原来每个围栏都向后 indexOf，大量未闭合围栏是平方复杂度（2 万个约 4.9 秒）。
// 现在第一次用到时把所有「可作结尾」的行（行首 n 个同一字符的 ` 或 ~，后面只有空白）按串分组，
// 位置递增；查找时二分出第一个 > start 的位置。整体 O(n log n)。
function fenceClosers(text) {
  const byFence = new Map(); // 串（如 '```'）-> [{ k: 行前换行位置, e: 行尾 }]
  for (let k = text.indexOf('\n'); k >= 0; k = text.indexOf('\n', k + 1)) {
    const c = text[k + 1];
    if (c !== '`' && c !== '~') continue;
    let f = k + 1;
    while (f < text.length && text[f] === c) f += 1;
    if (f - k - 1 < 3) continue;
    let e = f;
    while (e < text.length && (text[e] === ' ' || text[e] === '\t')) e += 1;
    if (e !== text.length && text[e] !== '\n') continue;
    const key = text.slice(k + 1, f);
    if (!byFence.has(key)) byFence.set(key, []);
    byFence.get(key).push({ k, e });
  }
  return byFence;
}

function findFenceEnd(closers, start, fence) {
  const list = closers.get(fence);
  if (!list) return -1;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].k >= start) hi = mid;
    else lo = mid + 1;
  }
  return lo < list.length ? list[lo].e : -1;
}

function lineSpans(text, lineStart) {
  let lineEnd = text.indexOf('\n', lineStart);
  if (lineEnd < 0) lineEnd = text.length;
  const ticks = new Map(); // 长度 -> 该行该长度反引号串的起点（递增）
  const closers = []; // 可作结尾的 $ 位置（递增）
  for (let i = lineStart; i < lineEnd; i += 1) {
    if (text[i] === '`') {
      let j = i;
      while (j < lineEnd && text[j] === '`') j += 1;
      const len = j - i;
      if (!ticks.has(len)) ticks.set(len, { pos: [], next: 0 });
      ticks.get(len).pos.push(i);
      i = j - 1;
    } else if (text[i] === '$' && i > lineStart && !/\s/.test(text[i - 1]) && !/\d/.test(text[i + 1] || '') && !isEscaped(text, i)) {
      closers.push(i);
    }
  }
  return { lineEnd, ticks, closers, nextCloser: 0 };
}

function protectedRanges(text) {
  const ranges = [];
  const n = text.length;
  let i = 0;
  let line = null;
  let fences = null;
  let noMoreDoubleDollar = false; // 某个 $$ 向后找不到结尾后，后面的 $$ 也不会有
  while (i < n) {
    if (i === 0 || text[i - 1] === '\n') {
      // 手工数围栏串（不用 /^(`{3,})[^\n]*\n/，它在无换行的长反引号串上会二次回溯）
      let f = i;
      while (f < n && text[f] === text[i] && (text[i] === '`' || text[i] === '~')) f += 1;
      const nl = text.indexOf('\n', f);
      const fm = f - i >= 3 && nl >= 0 ? [text.slice(i, nl + 1), text.slice(i, f)] : null;
      if (fm) {
        if (!fences) fences = fenceClosers(text);
        const end = findFenceEnd(fences, i + fm[0].length - 1, fm[1]);
        if (end >= 0) {
          ranges.push([i, end]);
          i = end;
          line = null;
          continue;
        }
      }
    }
    if (!line || i >= line.lineEnd) {
      const ls = text.lastIndexOf('\n', i - 1) + 1;
      line = lineSpans(text, ls);
    }
    const ch = text[i];
    if (ch === '$' && text[i + 1] === '$' && !noMoreDoubleDollar) {
      const end = text.indexOf('$$', i + 2);
      if (end < 0) noMoreDoubleDollar = true;
      if (end >= 0) {
        ranges.push([i, end + 2]);
        // batch9 ③：结尾还在同一行时保留本行的扫描结果，不再整行重扫（同一行 5000 个 $$a$$ 原来约 3 秒）
        if (end + 2 > line.lineEnd) line = null;
        i = end + 2;
        continue;
      }
    }
    if (ch === '`') {
      let j = i;
      while (j < line.lineEnd && text[j] === '`') j += 1;
      const g = line.ticks.get(j - i);
      while (g.next < g.pos.length && g.pos[g.next] <= i) g.next += 1;
      if (g.next < g.pos.length) {
        const close = g.pos[g.next];
        g.next += 1;
        ranges.push([i, close + (j - i)]);
        i = close + (j - i);
        continue;
      }
      i = j; // 没有配对：整串按普通文本
      continue;
    }
    if (ch === '$' && i + 1 < line.lineEnd && !/[\s$]/.test(text[i + 1]) && !isEscaped(text, i)) {
      const c = line.closers;
      while (line.nextCloser < c.length && c[line.nextCloser] <= i + 1) line.nextCloser += 1;
      if (line.nextCloser < c.length) {
        const close = c[line.nextCloser];
        ranges.push([i, close + 1]);
        i = close + 1;
        continue;
      }
    }
    i += 1;
  }
  return ranges;
}

// 审查 P3①：Pandoc 规定前面是 \ 的 $ 不算公式定界符（\\$ 是转义的反斜杠，后面的 $ 仍算）
function isEscaped(text, i) {
  let n = 0;
  for (let k = i - 1; k >= 0 && text[k] === '\\'; k -= 1) n += 1;
  return n % 2 === 1;
}

export function replaceOutsideProtected(text, fn) {
  let out = '';
  let last = 0;
  for (const [a, b] of protectedRanges(text)) {
    out += fn(text.slice(last, a)) + text.slice(a, b);
    last = b;
  }
  return out + fn(text.slice(last));
}
