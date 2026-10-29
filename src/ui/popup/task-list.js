import { translations } from '@config/locales';
import { taskErrorText } from './task-error-text';
import { TASK_STATUS } from '@config/constants';
import { formatTimeAgo } from '@utils/time-ago';
import { providerLabel } from '@config/pdf-providers';

let currentLang = 'en';

export function setTaskListLanguage(lang) {
  currentLang = lang || 'en';
}

// release-polish AR-04：任务行全部用 DOM API 构建（标题 / 错误来自远端数据），不再拼 HTML 字符串赋给 innerHTML
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(doc, tag, attrs = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

function downloadIcon(doc) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries({ 'aria-hidden': 'true', viewBox: '0 0 24 24', width: '14', height: '14', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' })) svg.setAttribute(k, v);
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M12 3v12m0 0 4-4m-4 4-4-4M5 21h14');
  svg.append(path);
  return svg;
}

/**
 * Round 3 C-2：popup v2 的紧凑行（徽标 · 标题 · 时间 · 操作）
 */
export function createTaskRow(task, doc = globalThis.document) {
  const t = translations[currentLang];
  const { id, status, progress, paperInfo = {}, createdAt, zipUrl } = task;
  // R4-03：失败原因按错误码 / reason 显示当前语言的白话（见 task-error-text.js），原文只放 title
  const error = status === TASK_STATUS.FAILED ? taskErrorText(task, t, providerLabel) : task.error;
  const title = paperInfo.title || paperInfo.arxivId || '';
  // 设计验收 R3 建议 1：行内用短格式（11 min. ago），给标题留宽度
  const timeAgo = formatTimeAgo(createdAt, currentLang, t.popup_time_just_now, Date.now(), 'narrow');
  const map = {
    [TASK_STATUS.PENDING]: ['run', t.popup_status_pending],
    [TASK_STATUS.PROCESSING]: ['run', t.popup_status_processing],
    [TASK_STATUS.COMPLETED]: ['ok', t.popup_status_completed],
    [TASK_STATUS.FAILED]: ['err', t.popup_status_failed],
    [TASK_STATUS.AWAITING_CONSENT]: ['wait', t.popup_status_awaiting], // 在等用户，和“处理中”区分
  };
  const [cls, label] = map[status] || ['idle', t.popup_status_unknown];
  const busy = status === TASK_STATUS.PENDING || status === TASK_STATUS.PROCESSING;
  const eid = String(id ?? '');
  const act = [];
  if (status === TASK_STATUS.COMPLETED && zipUrl) {
    act.push(el(doc, 'button', { class: 'btn btn-ghost btn-dl', 'data-action': 'download', 'data-url': zipUrl, title: t.popup_action_download, 'aria-label': t.popup_action_download },
      [downloadIcon(doc), el(doc, 'span', { class: 'lbl' }, [` ${t.popup_action_download}`])]));
  } else if (status === TASK_STATUS.AWAITING_CONSENT) {
    // 审查 P1-1：非 OA PDF，点了才弹确认框
    act.push(el(doc, 'button', { class: 'btn btn-ghost', 'data-action': 'consent', 'data-task-id': eid, 'data-provider': task.provider || '' }, [t.popup_action_consent]));
  } else if (status === TASK_STATUS.FAILED) {
    act.push(el(doc, 'button', { class: 'btn btn-ghost', 'data-action': 'retry', 'data-task-id': eid }, [t.popup_action_retry]));
  }
  act.push(el(doc, 'button', { class: 'btn btn-ghost', 'data-action': 'delete', 'data-task-id': eid, title: t.popup_action_delete, 'aria-label': t.popup_action_delete }, ['×']));
  const side = busy ? el(doc, 'small', { class: 'pct' }, [`${Number(progress) || 0}%`]) : el(doc, 'small', { class: 't' }, [String(timeAgo)]);
  const row = el(doc, 'div', { class: 'row', 'data-task-id': eid, 'data-status': status ?? '' }, [
    el(doc, 'span', { class: `badge ${cls}` }, [String(label ?? '')]),
    el(doc, 'span', { class: 'n', title }, [title]),
    el(doc, 'span', { class: 'prov' }, [providerLabel(task.provider)]),
    side,
    el(doc, 'span', { class: 'row-act' }, act),
  ]);
  // 设计 NTF4：失败原因最多两行（CSS line-clamp），完整原文放在 title 里
  if (status === TASK_STATUS.FAILED && error) row.append(el(doc, 'span', { class: 'row-err', title: String(error) }, [String(error)]));
  return row;
}

/**
 * 把任务行渲染进列表（replaceChildren，不经 innerHTML）。
 * A2-02：单条任务数据损坏只跳过这一条，不让整个列表变空。
 */
export function renderTaskRows(listEl, tasks, doc = listEl.ownerDocument) {
  const rows = [];
  for (const task of tasks || []) {
    try {
      rows.push(createTaskRow(task, doc));
    } catch (err) {
      console.warn('Skip broken task:', task && task.id, err);
    }
  }
  listEl.replaceChildren(...rows);
  return rows;
}
