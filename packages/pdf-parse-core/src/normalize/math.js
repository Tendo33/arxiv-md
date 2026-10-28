// 公式定界符统一：\( … \) → $…$，\[ … \] → $$…$$（KaTeX/Obsidian/Typora 通用）
import { withCodeProtected } from './protect.js';

export function normalizeMath(md) {
  return withCodeProtected(md, (s) => s
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body) => `$$${body.trim().includes('\n') ? `\n${body.trim()}\n` : body.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, body) => `$${body.trim()}$`));
}
