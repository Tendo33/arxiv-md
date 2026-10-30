// 设计附录 D3（AX-07）：任务行错误原因按语义段不拆词。每段包 <span class="nw">（white-space:nowrap），
// 段与段之间才允许断行。只认整句完全相同的中文短文案；认不出（含英文）→ null，按普通文本渲染。
// 文案仍以 locales.js 为准：这里的分段拼起来必须等于原句（tests/row-err-segments-ax07.test.js 校验）。
export const ZH_ROW_ERR_SEGMENTS = [
  ['额度已用完，', '请稍后再试', '或换一个后端'],
  ['请求太频繁，', '请稍等片刻', '再重试'],
  ['Key 无效', '或未填写'],
  ['PDF 太大，', '超出了限制'],
  ['连不上服务，', '请检查网络'],
  ['处理超时，', '任务已停止'],
  ['无法访问解析服务的网站，', '请重启浏览器', '后重试'],
  ['没能解析这个 PDF，', '可以重试，', '或在设置里', '换一个后端'],
  ['请求被拒绝', '（与 Key 或额度无关），', '可以稍后重试', '或换一个后端'],
  ['本设备还没有 Key', '（Key 不会跨设备同步），', '请在', '设置 › PDF 解析', '里填写'],
  ['解析结果没有正文，', '未保存文件。', '请直接打开 PDF，', '或换一个后端再试'],
  ['无法处理这个 PDF'],
];
const BY_TEXT = new Map(ZH_ROW_ERR_SEGMENTS.map((s) => [s.join(''), s]));
const HOST = /^(无法访问 )(\S+?)，请重启浏览器后重试$/;

/** @returns {string[]|null} */
export function rowErrSegments(text) {
  const s = String(text ?? '');
  if (BY_TEXT.has(s)) return BY_TEXT.get(s);
  const m = s.match(HOST);
  return m ? [m[1], `${m[2]}，`, '请重启浏览器', '后重试'] : null;
}
