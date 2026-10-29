// AR-02（release-polish 补丁）：所有“写文件前”的共用检查。HTML、ar5iv、PDF 解析三条路径都走这里：
// 没有正文 → 不写空文件、不显示「完成」，由调用方改走 PDF / 提示用户用 PDF。
import { ParseError, ERROR_REASONS } from '../errors.js';

/** 去掉 YAML 头、标题行、元数据引用块、分隔线和 LaTeXML 致命错误提示后，还有没有正文 */
export function hasMarkdownBody(markdown) {
  if (typeof markdown !== 'string') return false;
  const rest = markdown
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .split('\n')
    .filter((l) => !/^\s*(#{1,6}\s|>|[-*_]{3,}\s*$)/.test(l))
    .join('')
    .replace(/Conversion to HTML had a Fatal error and exited abruptly\.?( This document may be truncated or damaged\.)?/g, '')
    .replace(/\s+/g, '');
  return rest.length > 0;
}

/** 写文件前调用：没有正文就抛 PROVIDER_FAILED(reason=empty_result)，调用方据此不保存 */
export function assertSavableMarkdown(markdown, { provider } = {}) {
  if (!hasMarkdownBody(markdown)) throw new ParseError('PROVIDER_FAILED', { provider, reason: ERROR_REASONS.EMPTY_RESULT });
  return markdown;
}

export function isEmptyResultError(e) {
  return !!(e && e.reason === ERROR_REASONS.EMPTY_RESULT);
}
