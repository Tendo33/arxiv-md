// 公式定界符统一：\( … \) → $…$，\[ … \] → $$…$$（KaTeX/Obsidian/Typora 通用）
import { withCodeProtected } from './protect.js';

const isProse = (p) => !/^\s*(#|\$\$|<table|<div|!\[|\||```)/.test(p);
const depth = (f) => (f.match(/\(/g) || []).length - (f.match(/\)/g) || []).length;
const DANGLING_OP = /(\\leq|\\geq|\\le|\\ge|\\neq|\\approx|\\sim|\\cdot|\\times|[=<>+\-,])\s*$/;

/**
 * P-5：行内公式被版面块切成两段（GELU：「$ \Phi(x) = P(X \leq $」+ 空行 +「$ x), X \sim … $ is …」）。
 * PaddleOCR 把两半各自包成完整的 $…$，所以看括号：上一段最后一个行内公式括号没闭合（或以运算符结尾），
 * 下一段以行内公式开头且多出右括号 → 去掉中间这对 $，用空格接成一个段落、一个公式。
 */
export function mergeSplitInlineMath(md) {
  return withCodeProtected(md, (s) => {
    const out = [];
    for (const p of s.split(/\n{2,}/)) {
      const prev = out[out.length - 1];
      const tail = prev !== undefined && isProse(prev) ? /(?:^|[^$\\])\$([^$]+)\$\s*$/.exec(prev) : null;
      const head = tail && isProse(p) ? /^\s*\$(?!\$)([^$]+)\$/.exec(p) : null;
      if (tail && head && depth(head[1]) < 0 && (depth(tail[1]) > 0 || DANGLING_OP.test(tail[1]))) {
        out[out.length - 1] = `${prev.replace(/\s*\$\s*$/, '')} ${p.replace(/^\s*\$\s*/, '')}`;
      } else out.push(p);
    }
    return out.join('\n\n');
  });
}

export function normalizeMath(md) {
  return mergeSplitInlineMath(withCodeProtected(md, (s) => s
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body) => `$$${body.trim().includes('\n') ? `\n${body.trim()}\n` : body.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, body) => `$${body.trim()}$`)));
}
