// R4-03：任务列表的失败原因。用户看到的是当前语言的白话，不是 "paddleocr: NETWORK" 这样的原始码；
// title 仍是完整白话（设计 NTF4：两行截断，title 放全文）；原始码只在后台日志里。
// 优先级：err_reason_<reason> → err_<CODE>（PROVIDER_FAILED 的 {reason} 是原始信息，不展示）→ 通用失败文案。
const RAW_CODE = /^\s*([a-z0-9_-]+)\s*:\s*([A-Z_]+)\s*$/; // 旧任务只存了 "provider: CODE"

export function taskErrorText(task, t, providerLabel = (id) => id || '') {
  if (!task) return '';
  let code = task.errorCode || null;
  let provider = task.provider || null;
  if (!code && typeof task.error === 'string') {
    const m = task.error.match(RAW_CODE);
    if (m) { provider = provider || m[1]; code = m[2]; }
  }
  const label = providerLabel(provider);
  const fill = (s) => String(s).replace(/\{provider\}/g, label).replace(/\{host\}/g, task.errorHost || '');
  const reasonMsg = task.errorReason && t[`err_reason_${task.errorReason}`];
  if (reasonMsg) return fill(reasonMsg);
  // RATE_LIMITED 的 err_ 文案是“稍后自动重试”，任务已失败时不成立 → 用任务专用文案
  if (code === 'RATE_LIMITED') return fill(t.err_task_rate_limited);
  if (code && code !== 'PROVIDER_FAILED' && t[`err_${code}`] && !(code === 'PERMISSION_MISSING' && !task.errorHost)) return fill(t[`err_${code}`]);
  if (code) return fill(code === 'PERMISSION_MISSING' ? t.err_task_permission_plain : t.err_task_failed_plain);
  return task.error ? String(task.error) : fill(t.err_task_failed_plain);
}
