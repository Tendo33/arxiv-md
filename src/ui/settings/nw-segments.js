// design-abs-buttons-2026-10-29 R09 / B8：中文按短语断行。
// CJK 的 text-wrap: pretty 不生效，窄屏会把「默认策|略」这类词拆开；这里把句子切成 .nw 片段，片段内不换行。
// 只对 zh 生效；片段拼起来必须与文案一字不差（测试保证），AR-04：只用 DOM API。
export const NW_ZH = {
  mode_desc: ['选择论文转换的', '默认策略'],
  mode_standard_desc: ['先 arXiv HTML，', '再 ar5iv，', '失败时下载 PDF'],
  mode_mineru_desc: ['始终用 PDF 解析', '（使用下方选择的后端）'],
  welcome_desc: ['一键将 arXiv 论文', '转换为 Markdown。', '先用 arXiv HTML，', '再试 ar5iv，', '失败时下载 PDF。'],
  advanced_auto: ['自动转换', '（进入论文页面', '自动弹出转换提示）'],
  advanced_metadata: ['在 Markdown 中', '包含元数据', '（标题、作者、ID 等）'],
  advanced_pdf_fab: ['在 PDF 页显示', '悬浮导出按钮'],
};

/** 没有手工切分表的中文句子：在 ，。；、） 之后切开，片段仍不超过一个分句 */
export function splitZh(text) {
  const out = String(text || '').match(/[^，。；）]*[，。；）]?/g).filter(Boolean);
  return out.length ? out : [String(text || '')];
}

/** 返回要放进元素的子节点：zh → .nw span 列表；其他语言 → 原文 */
export function nwNodes(doc, key, text, lang) {
  if (lang !== 'zh' || !text) return [text];
  const table = NW_ZH[key];
  const segs = table && table.join('') === text ? table : splitZh(text);
  if (segs.length < 2) return [text];
  return segs.map((s) => {
    const sp = doc.createElement('span');
    sp.className = 'nw';
    sp.textContent = s;
    return sp;
  });
}

export function setNwText(el, key, text, lang) {
  el.replaceChildren(...nwNodes(el.ownerDocument, key, text, lang));
}
