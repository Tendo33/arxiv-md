// 表格：默认保留 HTML；toGfm=true 时只转“没有合并单元格”的简单表
import { withCodeProtected } from './protect.js';

const decode = (s) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const cell = (s) => decode(s).replace(/\|/g, '\\|');

/** @returns {string|null} 转不了（合并单元格/嵌套表/空表/列数不齐）返回 null */
export function htmlTableToGfm(html) {
  const inner = html.replace(/^<table[^>]*>|<\/table>$/gi, '');
  if (/<table/i.test(inner)) return null;
  if (/\b(rowspan|colspan)\s*=\s*["']?(?!1\b)\d+/i.test(html)) return null;
  const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => [...m[1].matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t\1>/gi)].map((c) => cell(c[2])));
  if (!rows.length || !rows[0].length) return null;
  const w = rows[0].length;
  if (rows.some((r) => r.length !== w)) return null;
  const line = (r) => `| ${r.join(' | ')} |`;
  return [line(rows[0]), line(new Array(w).fill('---')), ...rows.slice(1).map(line)].join('\n');
}

const LATEX_HINT = /\\[A-Za-z]+|[\^_]\{/;

/** P-3：单元格是裸 LaTeX（含 \cmd、^{、_{ 且没有 $）时补 $…$；去掉命令和花括号后还剩 3 个以上连续字母的视为普通文本，不包 */
export function wrapCellMath(cellHtml) {
  const body = String(cellHtml);
  const t = body.trim();
  if (!t || t.includes('$') || /<[a-z/!]/i.test(t) || !LATEX_HINT.test(t)) return body;
  const rest = t.replace(/\\[A-Za-z]+/g, ' ').replace(/\{[^{}]*\}/g, ' ');
  if (/[A-Za-z]{3,}/.test(rest)) return body;
  return `$${t}$`;
}

export function wrapTableMath(md) {
  return withCodeProtected(md, (s) => s.replace(/<table[\s\S]*?<\/table>/gi, (tbl) => tbl.replace(/(<t([hd])\b[^>]*>)([\s\S]*?)(<\/t\2>)/gi, (_, open, _t, inner, close) => `${open}${wrapCellMath(inner)}${close}`)));
}

export function normalizeTables(md, { toGfm = false } = {}) {
  md = wrapTableMath(md);
  if (!toGfm) return md;
  return withCodeProtected(md, (s) => s.replace(/<table[\s\S]*?<\/table>/gi, (t) => {
    const g = htmlTableToGfm(t);
    return g ? `\n${g}\n` : t;
  }));
}
