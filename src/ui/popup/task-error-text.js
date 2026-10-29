// R4-03：任务列表的失败原因。用户看到的是当前语言的白话，不是 "paddleocr: NETWORK" 这样的原始码；
// title 仍是完整白话（设计 NTF4：两行截断，title 放全文）；原始码只在后台日志里。
// rp2b（设计 ①②）：任务行旁边已单独显示后端名（S-2：每行只出现一次），所以这里一律用不带后端名的
// err_short_* 文案；通知和页面卡片没有单独的后端名，继续用带 {provider} 的 err_* / err_reason_*。
// 优先级：err_short_reason_<reason> → err_reason_<reason>（本身不带后端名，如 empty_result）→ err_short_<CODE> → 通用失败文案。
const RAW_CODE = /^\s*([a-z0-9_-]+)\s*:\s*([A-Z_]+)\s*$/; // 旧任务只存了 "provider: CODE"

/** 不带后端名的短文案；认不出时返回 null。task-list 和设置页共用 */
export function shortErrorText({ code, reason, host }, t) {
  const fill = (s) => String(s).replace(/\{host\}/g, host || '');
  const r = reason && (t[`err_short_reason_${reason}`] || t[`err_reason_${reason}`]);
  if (r) return fill(r);
  if (code === 'PERMISSION_MISSING') return fill(host ? t.err_short_PERMISSION_MISSING : t.err_short_permission_plain);
  if (code && code !== 'PROVIDER_FAILED' && t[`err_short_${code}`]) return fill(t[`err_short_${code}`]);
  return null;
}

export function taskErrorText(task, t) {
  if (!task) return '';
  let code = task.errorCode || null;
  if (!code && typeof task.error === 'string') {
    const m = task.error.match(RAW_CODE);
    if (m) code = m[2];
  }
  const s = shortErrorText({ code, reason: task.errorReason, host: task.errorHost }, t);
  if (s) return s;
  // R5-03：认不出（包括没有 errorCode 的旧任务 / 未分类异常）一律通用白话；原文只进 title（见 taskErrorTitle）
  return t.err_short_failed_plain;
}

/**
 * R5-03：失败行的 title。只有「认不出」的原文（没有 errorCode、也不是 "provider: CODE"）才放进 title 便于排查；
 * 有错误码的任务 title 仍是完整白话（NTF4），原始码只在后台日志。
 */
export function taskErrorTitle(task, shown) {
  const raw = task && typeof task.error === 'string' ? task.error.trim() : '';
  if (!raw || task.errorCode || task.errorReason || RAW_CODE.test(raw)) return shown;
  return raw;
}
