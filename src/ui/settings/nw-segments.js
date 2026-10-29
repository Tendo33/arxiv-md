// design-abs-buttons-2026-10-29 R09 / B8：中文按短语断行。
// CJK 的 text-wrap: pretty 不生效，窄屏会把「默认策|略」这类词拆开；这里把句子切成 .nw 片段，片段内不换行。
// 只对 zh 生效；片段拼起来必须与文案一字不差（测试保证），AR-04：只用 DOM API。
/** 自动切分片段超过这个长度不加 .nw（设计验收 30a6e1b #2） */
export const NW_MAX = 12;

export const NW_ZH = {
  mode_desc: ['选择论文转换的', '默认策略'],
  mode_standard_desc: ['先 arXiv HTML，', '再 ar5iv，', '失败时下载 PDF'],
  mode_mineru_desc: ['始终用 PDF 解析', '（使用下方选择的后端）'],
  welcome_desc: ['一键将 arXiv 论文', '转换为 Markdown。', '先用 arXiv HTML，', '再试 ar5iv，', '失败时下载 PDF。'],
  advanced_auto: ['自动转换', '（进入论文页面', '自动弹出转换提示）'],
  advanced_metadata: ['在 Markdown 中', '包含元数据', '（标题、作者、ID 等）'],
  pdf_desc: ['PaddleOCR 会上传', '来自 arXiv 的 PDF 文件', '（50 MB 以内）；', 'MinerU 和', '其他网站的 PDF ', '只发送链接。', 'Key 只保存在本机，', '只发给你选择的服务。'],
  // 设计 C11 #3：数据说明正文按短语断行（逐字照抄）；短语间的空格单列为 ' '，放在 span 外面
  pdf_disc_body_paddleocr: ['使用 PaddleOCR 时，', '来自 arXiv 的 PDF 文件', '（50 MB 以内）', '会连同你的访问令牌', '和解析选项', '上传到百度飞桨星河社区；', '更大的 PDF 不会发送。', '其他网站的 PDF', ' ', '只发送链接，', '并且每次都要你确认。'],
  pdf_disc_body_mineru: ['使用 MinerU 时，', '论文的 PDF 链接', '（另加 arXiv ID）', '会连同你的 API Key', ' ', '和解析选项', '发给 MinerU（mineru.net），', '由它下载并解析；', 'PDF 文件本身不会上传。', '其他网站的 PDF', ' ', '每次都要你确认后才发送。'],
  // 设计验收 30a6e1b #3：卡片描述手工分段，避免「百|度」「免|费」「页|数」拆词；空格单列放在 span 外
  pdf_card_paddleocr: ['把来自 arXiv 的', ' ', 'PDF 文件', '（50 MB 以内）', '上传到', '百度飞桨星河社区；', '其他 PDF', ' ', '只发送链接。', '每日有免费额度。'],
  pdf_card_mineru: ['只把 PDF 链接', '发往', ' ', 'mineru.net，', '免费账号', '每日有页数上限。'],
  // 设计 C14：PaddleOCR 隐私链接文字两段，↗ 跟在「（中文）」后面
  pdf_disc_link_paddleocr: ['百度隐私权保护声明', '（中文）'],
  advanced_pdf_fab: ['在 PDF 页显示', '悬浮导出按钮'],
};

/** 没有手工切分表的中文句子：在 ，。；） 之后、以及中英文之间的空格处切开（如「访问 {host} 才能使用」），片段仍不超过一个分句 */
export function splitZh(text) {
  const out = String(text || '').match(/[^，。；）\s]*(?:[，。；）]|\s+)?/g).filter(Boolean);
  return out.length ? out : [String(text || '')];
}

/** 返回要放进元素的子节点：zh → .nw span 列表；其他语言 → 原文 */
export function nwNodes(doc, key, text, lang) {
  if (lang !== 'zh' || !text) return [text];
  const table = NW_ZH[key];
  const manual = !!(table && table.join('') === text);
  const segs = manual ? table : splitZh(text);
  if (segs.length < 2) return [text];
  return segs.map((s) => {
    if (/^\s+$/.test(s)) return doc.createTextNode(s); // C11 #3：空格在 span 外，可在此换行
    // 设计验收 30a6e1b #2：自动切分的兜底片段超过 NW_MAX 字就不加 .nw，宁可词内断行也不溢出
    if (!manual && s.trim().length > NW_MAX) return doc.createTextNode(s);
    const sp = doc.createElement('span');
    sp.className = 'nw';
    sp.textContent = s;
    return sp;
  });
}

export function setNwText(el, key, text, lang) {
  el.replaceChildren(...nwNodes(el.ownerDocument, key, text, lang));
}
