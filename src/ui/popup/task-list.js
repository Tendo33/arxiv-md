import { translations } from '@config/locales';
import { taskErrorText, taskErrorTitle } from './task-error-text';
import { rowErrSegments } from './row-err-segments';

// 设计 D3（AX-07）：已知中文短文案按语义段包 .nw，段内不断行
const errNodes = (doc, text) => { const seg = rowErrSegments(text); return seg ? seg.map((x) => el(doc, 'span', { class: 'nw' }, [x])) : [text]; };
import { TASK_STATUS } from '@config/constants';
import { formatTimeAgo } from '@utils/time-ago';
import { providerLabel } from '@config/pdf-providers';
import { nwNodes } from '../settings/nw-segments';

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
    // 1.2.2 前留下的 awaiting_* 任务：显示「需重试」，点重试直接解析
    [TASK_STATUS.AWAITING_CONSENT]: ['wait', t.popup_status_needs_retry],
    [TASK_STATUS.AWAITING_DISCLOSURE]: ['wait', t.popup_status_needs_retry],
  };
  const [cls, label] = map[status] || ['idle', t.popup_status_unknown];
  const busy = status === TASK_STATUS.PENDING || status === TASK_STATUS.PROCESSING;
  const eid = String(id ?? '');
  const act = [];
  if (status === TASK_STATUS.COMPLETED && zipUrl) {
    act.push(el(doc, 'button', { class: 'btn btn-ghost btn-dl', 'data-action': 'download', 'data-url': zipUrl, title: t.popup_action_download, 'aria-label': t.popup_action_download },
      [downloadIcon(doc), el(doc, 'span', { class: 'lbl' }, [` ${t.popup_action_download}`])]));
  } else if (status === TASK_STATUS.FAILED || status === TASK_STATUS.AWAITING_CONSENT || status === TASK_STATUS.AWAITING_DISCLOSURE) {
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
  if (status === TASK_STATUS.FAILED && error) row.append(el(doc, 'span', { class: 'row-err', title: taskErrorTitle(task, String(error)) }, [
    // rp2c（设计终验 ①）：窄宽可见的后端名前缀；aria-hidden，读屏只读 .prov 那一次；title 仍只放原因
    el(doc, 'span', { class: 'row-err-prov', 'aria-hidden': 'true' }, [`${providerLabel(task.provider)} · `]),
    ...errNodes(doc, String(error)),
  ]));
  // QA P2-DNR + 审查 P3(a)：等扩展页关闭后自重载的任务，明确说明在等什么、要用户做什么
  if (status === TASK_STATUS.PENDING && task.dnrReinitWaitSince != null) row.append(el(doc, 'span', { class: 'row-note', role: 'status' }, nwNodes(doc, 'popup_note_dnr_wait', t.popup_note_dnr_wait, currentLang))); // 设计复验 6a49976 裁定 3：zh 用 .nw 分段
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

/**
 * 设计裁定 R-2（原话「左边与标题文字对齐」）：.row-note 的左缘对齐 .n 的文字左缘。
 * 360/375 时标题在徽标之后，≤340 时标题换到整行，所以缩进量随宽度和徽标文案变化，只能量出来：
 * 写到行上的 --note-indent，CSS 用它做 margin-left，并从 flex-basis 里扣掉，不会溢出。
 */
export function alignRowNotes(listEl) {
  if (!listEl) return;
  for (const row of listEl.querySelectorAll('.row')) {
    const note = row.querySelector('.row-note');
    const n = row.querySelector('.n');
    if (!note || !n) continue;
    row.style.removeProperty('--note-indent');
    const indent = n.getBoundingClientRect().left - note.getBoundingClientRect().left;
    if (indent > 0.01) row.style.setProperty('--note-indent', `${Math.round(indent * 100) / 100}px`);
  }
}
