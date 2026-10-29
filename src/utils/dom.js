// release-polish AR-04：用 DOM API 构建界面，不再把 HTML 字符串赋给 innerHTML（AMO UNSAFE_VAR_ASSIGNMENT）。
// 文案、标题等页面 / 用户数据一律走 textContent。

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    el.setAttribute(k, String(v));
  }
  return el;
}

function append(el, children) {
  for (const c of [].concat(children ?? [])) {
    if (c == null || c === false) continue;
    el.append(typeof c === 'string' ? el.ownerDocument.createTextNode(c) : c);
  }
  return el;
}

/** HTML 元素；字符串子节点作为文本插入 */
export function h(doc, tag, attrs, children) {
  return append(apply(doc.createElement(tag), attrs), children);
}

/**
 * SVG：spec = [tag, attrs, children?]，children 同样是 spec 数组。
 * @example svg(document, ['svg', { viewBox: '0 0 16 16' }, [['path', { d: 'M0 0h1' }]]])
 */
export function svg(doc, [tag, attrs, children]) {
  const el = apply(doc.createElementNS(SVG_NS, tag), attrs);
  for (const c of children || []) el.appendChild(svg(doc, c));
  return el;
}

/** 清空后放入新的子节点 */
export function setChildren(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/** AR-04：复制子节点（与复制 innerHTML 结果相同，但不重新解析 HTML） */
export function copyChildren(src, dst) {
  dst.append(...Array.from(src.childNodes, (n) => n.cloneNode(true)));
  return dst;
}

/** AR-04：只改文本节点 */
export function replaceInTextNodes(root, pattern, replacement) {
  for (const n of Array.from(root.childNodes)) {
    if (n.nodeType === 3) n.nodeValue = n.nodeValue.replace(pattern, replacement);
    else if (n.nodeType === 1) replaceInTextNodes(n, pattern, replacement);
  }
}
