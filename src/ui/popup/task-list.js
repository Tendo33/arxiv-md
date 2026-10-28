import { translations } from '@config/locales';
import { TASK_STATUS } from '@config/constants';
import { formatTimeAgo } from '@utils/time-ago';

let currentLang = 'en';

/** Escapes text for interpolation into popup HTML (titles/errors come from remote data). */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setTaskListLanguage(lang) {
  currentLang = lang || 'en';
}

/**
 * 渲染任务列表
 */
export function renderTaskList(tasks) {
  const listEl = document.getElementById('taskList');
  const emptyStateEl = document.getElementById('emptyState');

  if (!tasks || tasks.length === 0) {
    listEl.innerHTML = '';
    emptyStateEl.style.display = 'flex';
    return;
  }

  emptyStateEl.style.display = 'none';

  // 按创建时间倒序排列（最新的在前）
  // 时间无效的排在最后，避免 NaN 打乱排序
  const timeOf = (t) => (t && Number.isFinite(t.createdAt) ? t.createdAt : -Infinity);
  const sortedTasks = [...tasks].sort((a, b) => {
    const ta = timeOf(a), tb = timeOf(b);
    return ta === tb ? 0 : tb > ta ? 1 : -1;
  });

  // A2-02：单条任务数据损坏只跳过这一条，不让整个列表变空
  listEl.innerHTML = sortedTasks.map((task) => {
    try {
      return createTaskCard(task);
    } catch (err) {
      console.warn('Skip broken task:', task && task.id, err);
      return '';
    }
  }).join('');
}

/**
 * 创建任务卡片 HTML
 */
export function createTaskCard(task) {
  const {
    id,
    status,
    progress,
    paperInfo,
    createdAt,
    zipUrl,
    error,
  } = task;

  const title = paperInfo.title || paperInfo.arxivId;
  const truncatedTitle =
    title.length > 50 ? title.substring(0, 50) + '…' : title;
  const timeAgo = formatTimeAgo(createdAt, currentLang, translations[currentLang].popup_time_just_now);

  // 状态显示
  const statusDisplay = getStatusDisplay(status);

  // 进度条
  const progressBar =
    status === TASK_STATUS.PROCESSING || status === TASK_STATUS.PENDING
      ? `
    <div class="task-progress">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <span class="progress-text">${progress}%</span>
    </div>
  `
      : '';

  // 操作按钮
  const actions = getTaskActions(task);

  return `
    <div class="task-card" data-task-id="${escapeHtml(id)}" data-status="${escapeHtml(status)}">
      <div class="task-header">
        <div class="task-status status-${status}">
          <span class="status-icon">${statusDisplay.icon}</span>
          <span class="status-text">${statusDisplay.text}</span>
        </div>
        <button class="delete-btn" data-action="delete" data-task-id="${escapeHtml(id)}" title="${translations[currentLang].popup_action_delete}" aria-label="${translations[currentLang].popup_action_delete}">×</button>
      </div>
      
      <div class="task-content">
        <h3 class="task-title" title="${escapeHtml(title)}">${escapeHtml(truncatedTitle)}</h3>
        <div class="task-meta">
          <span class="meta-id">${escapeHtml(paperInfo.arxivId)}</span>
          <span class="meta-time">${timeAgo}</span>
        </div>
        ${error ? `<div class="task-error">❌ ${escapeHtml(error)}</div>` : ''}
      </div>
      
      ${progressBar}
      
      <div class="task-actions">
        ${actions}
      </div>
    </div>
  `;
}

/**
 * 获取状态显示信息
 */
export function getStatusDisplay(status) {
  const t = translations[currentLang];
  const icons = {
    [TASK_STATUS.PENDING]: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    [TASK_STATUS.PROCESSING]: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
    [TASK_STATUS.COMPLETED]: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
    [TASK_STATUS.FAILED]: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
  };
  const displays = {
    [TASK_STATUS.PENDING]: {
      icon: icons[TASK_STATUS.PENDING],
      text: t.popup_status_pending || 'Pending',
    },
    [TASK_STATUS.PROCESSING]: {
      icon: icons[TASK_STATUS.PROCESSING],
      text: t.popup_status_processing || 'Processing',
    },
    [TASK_STATUS.COMPLETED]: {
      icon: icons[TASK_STATUS.COMPLETED],
      text: t.popup_status_completed || 'Completed',
    },
    [TASK_STATUS.FAILED]: {
      icon: icons[TASK_STATUS.FAILED],
      text: t.popup_status_failed || 'Failed',
    },
  };
  return (
    displays[status] || { icon: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.1-1.5 2"/><path d="M12 17h.01"/></svg>', text: t.popup_status_unknown || 'Unknown' }
  );
}

/**
 * 获取任务操作按钮
 */
export function getTaskActions(task) {
  const { status, zipUrl } = task;
  const t = translations[currentLang];

  if (status === TASK_STATUS.COMPLETED && zipUrl) {
    return `
      <button class="action-btn download-btn" data-action="download" data-url="${escapeHtml(zipUrl)}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg> ${t.popup_action_download}
      </button>
      <button class="action-btn secondary-btn" data-action="copy" data-url="${escapeHtml(zipUrl)}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ${t.popup_action_copy}
      </button>
    `;
  }

  if (status === TASK_STATUS.FAILED) {
    return `
      <button class="action-btn retry-btn" data-action="retry" data-task-id="${escapeHtml(task.id)}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/></svg> ${t.popup_action_retry}
      </button>
    `;
  }

  return `<span class="action-placeholder">${t.popup_status_processing}…</span>`;
}


/**
 * Round 3 C-2：popup v2 的紧凑行（徽标 · 标题 · 时间 · 操作）
 */
export function createTaskRow(task) {
  const t = translations[currentLang];
  const { id, status, progress, paperInfo = {}, createdAt, zipUrl, error } = task;
  const title = paperInfo.title || paperInfo.arxivId || '';
  // 设计验收 R3 建议 1：行内用短格式（11 min. ago），给标题留宽度
  const timeAgo = formatTimeAgo(createdAt, currentLang, t.popup_time_just_now, Date.now(), 'narrow');
  const map = {
    [TASK_STATUS.PENDING]: ['run', t.popup_status_pending],
    [TASK_STATUS.PROCESSING]: ['run', t.popup_status_processing],
    [TASK_STATUS.COMPLETED]: ['ok', t.popup_status_completed],
    [TASK_STATUS.FAILED]: ['err', t.popup_status_failed],
  };
  const [cls, label] = map[status] || ['idle', t.popup_status_unknown];
  const busy = status === TASK_STATUS.PENDING || status === TASK_STATUS.PROCESSING;
  const eid = escapeHtml(id);
  let act = '';
  if (status === TASK_STATUS.COMPLETED && zipUrl) {
    act = `<button class="btn btn-ghost btn-dl" data-action="download" data-url="${escapeHtml(zipUrl)}" title="${t.popup_action_download}" aria-label="${t.popup_action_download}"><svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg><span class="lbl"> ${t.popup_action_download}</span></button>`;
  } else if (status === TASK_STATUS.FAILED) {
    act = `<button class="btn btn-ghost" data-action="retry" data-task-id="${eid}">${t.popup_action_retry}</button>`;
  }
  act += `<button class="btn btn-ghost" data-action="delete" data-task-id="${eid}" title="${t.popup_action_delete}" aria-label="${t.popup_action_delete}">×</button>`;
  const side = busy ? `<small class="pct">${Number(progress) || 0}%</small>` : `<small>${escapeHtml(timeAgo)}</small>`;
  return `<div class="row" data-task-id="${eid}" data-status="${escapeHtml(status)}"${error ? ` title="${escapeHtml(error)}"` : ''}><span class="badge ${cls}">${escapeHtml(label)}</span><span class="n" title="${escapeHtml(title)}">${escapeHtml(title)}</span>${side}<span class="row-act">${act}</span></div>`;
}
