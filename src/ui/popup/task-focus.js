/**
 * 设计验收 M8：任务列表重绘会替换掉行内按钮，焦点会掉到 body。
 * 重绘后按 taskId 找回这一行的按钮；这一行没了就落到任务列表本身（#taskList tabindex=-1）。
 */
export function refocusTask(doc, taskId) {
  const esc = String(taskId).replace(/["\\]/g, '\\$&');
  const el = doc.querySelector(`button[data-task-id="${esc}"]`);
  const target = el || doc.getElementById('taskList');
  if (target && typeof target.focus === 'function') target.focus();
  return target;
}
