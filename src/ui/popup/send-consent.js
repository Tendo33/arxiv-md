// 审查 P1-1：非 OA PDF 先弹确认框，用户点「发送并解析」后才让后台把 PDF 链接发给后端；取消则什么都不发
import { providerLabel } from '@config/pdf-providers';

const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/** @param {{id:string, provider?:string, paperInfo?:{title?:string, arxivId?:string}}|string} task */
export async function confirmSendFlow(task, providerId, { showConfirm, sendMessage, tr }) {
  const t = typeof task === 'string' ? { id: task } : task;
  const info = t.paperInfo || {};
  const vars = { provider: providerLabel(providerId || t.provider), title: info.title || info.arxivId || t.id };
  const ok = await showConfirm(fill(tr.popup_confirm_send, vars), {
    title: fill(tr.popup_confirm_send_title, vars), okLabel: tr.popup_btn_send, tone: 'brand',
  });
  if (!ok) return false;
  const res = await sendMessage({ type: 'CONFIRM_PDF_SEND', taskId: t.id });
  return !!(res && res.success);
}

/**
 * 设计验收 M8：确认框关闭后任务列表会重绘，原来的「确认解析」按钮已被替换，焦点会掉到 body。
 * 重绘后按 taskId 找回这一行的按钮；这一行没了就落到任务列表本身（#taskList tabindex=-1）。
 */
export function refocusTask(doc, taskId) {
  const esc = String(taskId).replace(/["\\]/g, '\\$&');
  const el = doc.querySelector(`[data-action="consent"][data-task-id="${esc}"]`) || doc.querySelector(`button[data-task-id="${esc}"]`);
  const target = el || doc.getElementById('taskList');
  if (target && typeof target.focus === 'function') target.focus();
  return target;
}
