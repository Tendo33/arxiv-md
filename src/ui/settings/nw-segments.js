// design-abs-buttons-2026-10-29 R09 / B8：中文按短语断行。
// CJK 的 text-wrap: pretty 不生效，窄屏会把「默认策|略」这类词拆开；这里把句子切成 .nw 片段，片段内不换行。
// 只对 zh 生效；片段拼起来必须与文案一字不差（测试保证），AR-04：只用 DOM API。
/** 自动切分片段超过这个长度不加 .nw（设计验收 30a6e1b #2） */
export const NW_MAX = 12;

export const NW_ZH = {
  mode_standard_desc: ['转换 HTML 版本', '（先 arXiv，', '再 ar5iv），', '都没有时保存 PDF。'],
  mode_mineru_desc: ['总是用下方选择的服务', '解析 PDF。', '较慢，', '但所有论文都能用。'],
  welcome_desc: ['打开任意 arXiv 论文，', '点「Submission history」', '下方的', ' ', 'Markdown 按钮即可。', '下面的设置', '都是可选的。'],
  advanced_auto: ['打开论文时', '询问是否导出'],
  advanced_metadata: ['在文件开头', '写入元数据', '（标题、作者、', 'arXiv ID、年份）'],
  pdf_desc: ['直接解析 PDF，', '适合没有 HTML 版本的论文，', '需要解析服务的 Key。', 'Key 只保存在本机，', '只发给对应的服务；', '导出时会直接发送 PDF，', '不再确认。'],
  // 设计验收 30a6e1b #3：卡片描述手工分段，避免「百|度」「免|费」「页|数」拆词；短语间的空格单列为 ' '，放在 span 外
  pdf_card_paddleocr: ['把 arXiv 的', ' ', 'PDF 文件', '（50 MB 以内）', '上传到', '百度飞桨星河社区，', '其他 PDF', ' ', '只发链接。', '每日有免费额度。'],
  pdf_card_mineru: ['只把 PDF 链接', '发给', ' ', 'mineru.net，', '免费账号', '每日有页数上限。'],
  // 设计复验 15fe0f9 必须改 3（R09）：弹窗无 Key / 未确认提示 #keyHereHint 不拆词（「解|析」「备|的」）
  popup_key_here_hint: ['Key 不会', '跨设备同步，', '请在', '设置 › PDF 解析', '里重新填写'],
  popup_err_token_hint: ['在', '设置 › PDF 解析', '里填写，', '或改用「导出 Markdown」'],
  advanced_pdf_fab: ['在 PDF 页显示', '悬浮导出按钮'],
  pdf_privacy_link_paddleocr: ['百度隐私权保护声明', '（中文）'],
  pdf_privacy_link_mineru: ['MinerU', ' ', '个人信息保护政策', '（OpenXLab，', '中文）'],
  // 设计复验 6a49976 裁定 3（P2-DNR 文案定稿）：popup 任务行等待提示不拆词（「展|会」「动|重」）
  popup_note_dnr_wait: ['正在完成初始化。', '关闭此弹窗和设置页后，', '扩展会自动重启一次', '并继续。'],
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
