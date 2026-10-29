// design-abs-buttons-2026-10-29 附录 C：首次选择 PaddleOCR / MinerU 时，在卡片下方就地显示数据说明 + 确认。
// AR-04：只用 DOM API 构建，文案走 textContent。
import { h, svg } from '@utils/dom';

export const PRIVACY_LINKS = {
  paddleocr: 'https://www.baidu.com/duty/yinsiquan.html',
  mineru: 'https://sso.openxlab.org.cn/protocol/privacy',
};
const EXT = ['svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'aria-hidden': 'true' }, [
  ['path', { d: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }],
]];
/**
 * 设计 C14：链接文字最后一段和 ↗ 图标放进同一个 .nw，窄屏下图标不会单独落到下一行。
 * zh：最后一个 .nw 片段直接收下图标；en/未分段：最后一个词和图标包进新的 .nw。
 */
export function glueIcon(doc, parts, icon) {
  const nodes = (Array.isArray(parts) ? parts : [parts]).map((n) => (typeof n === 'string' ? doc.createTextNode(n) : n));
  const last = nodes[nodes.length - 1];
  if (last && last.nodeType === 1 && last.classList.contains('nw')) { last.append(icon); return nodes; }
  const text = last ? last.textContent : '';
  const i = text.lastIndexOf(' ');
  const tail = doc.createElement('span');
  tail.className = 'nw';
  tail.append(doc.createTextNode(i >= 0 ? text.slice(i + 1) : text), icon);
  nodes.splice(nodes.length - 1, 1, ...(i >= 0 ? [doc.createTextNode(text.slice(0, i + 1))] : []), tail);
  return nodes;
}
const fmt = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/**
 * @param {Document} doc
 * @param {Object} tr 当前语言文案
 * @param {{id:string,label:string}} provider
 * @param {(key:string, text:string)=>Node[]|string} [seg] 中文按短语断行（.nw）
 */
export function buildDisclosurePanel(doc, tr, provider, seg = (k, t) => t) {
  const { id, label } = provider;
  const vars = { provider: label };
  const titleId = `pdTitle-${id}`;
  const bodyId = `pdBody-${id}`;
  const title = h(doc, 'h3', { class: 'pd-title', id: titleId, tabindex: '-1' }, seg('pdf_disc_title', fmt(tr.pdf_disc_title, vars)));
  const body = h(doc, 'p', { class: 'pd-body', id: bodyId }, seg(`pdf_disc_body_${id}`, tr[`pdf_disc_body_${id}`]));
  const link = h(doc, 'a', { class: 'pd-link', href: PRIVACY_LINKS[id], target: '_blank', rel: 'noopener noreferrer' }, [
    h(doc, 'span', { class: 'pd-link-text' }, glueIcon(doc, seg(`pdf_disc_link_${id}`, tr[`pdf_disc_link_${id}`]), svg(doc, EXT))),
    h(doc, 'span', { class: 'sr-only' }, tr.link_new_tab),
  ]);
  const ok = h(doc, 'button', { type: 'button', class: 'btn btn-primary pd-ok' }, tr.pdf_disc_ok);
  const cancel = h(doc, 'button', { type: 'button', class: 'btn btn-secondary pd-cancel' }, tr.pdf_disc_cancel);
  const panel = h(doc, 'div', { class: 'pd-panel', id: 'pdPanel', 'data-provider': id, role: 'group', 'aria-labelledby': titleId, 'aria-describedby': bodyId }, [
    title, body, link, h(doc, 'div', { class: 'pd-actions' }, [ok, cancel]),
  ]);
  return { panel, title, ok, cancel };
}
