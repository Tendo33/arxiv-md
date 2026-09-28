import { translations } from '@config/locales';
import { TASK_STATUS } from '@config/constants';

let currentLang = 'en';

export function setTaskListLanguage(lang) {
  currentLang = lang || 'en';
}

/**
 * 格式化时间
 */
function formatTimeAgo(timestamp) {
  const t = translations[currentLang];
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t.popup_time_just_now;
  if (minutes < 60) return `${minutes}${t.popup_time_mins_ago}`;
  if (hours < 24) return `${hours}${t.popup_time_hours_ago}`;
  return `${days}${t.popup_time_days_ago}`;
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
  const sortedTasks = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

  listEl.innerHTML = sortedTasks.map(createTaskCard).join('');
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
    title.length > 50 ? title.substring(0, 50) + '...' : title;
  const timeAgo = formatTimeAgo(createdAt);

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
    <div class="task-card" data-task-id="${id}" data-status="${status}">
      <div class="task-header">
        <div class="task-status status-${status}">
          <span class="status-icon">${statusDisplay.icon}</span>
          <span class="status-text">${statusDisplay.text}</span>
        </div>
        <button class="delete-btn" data-action="delete" data-task-id="${id}" title="${translations[currentLang].popup_action_delete}" aria-label="${translations[currentLang].popup_action_delete}">×</button>
      </div>
      
      <div class="task-content">
        <h3 class="task-title" title="${title}">${truncatedTitle}</h3>
        <div class="task-meta">
          <span class="meta-id">${paperInfo.arxivId}</span>
          <span class="meta-time">${timeAgo}</span>
        </div>
        ${error ? `<div class="task-error">❌ ${error}</div>` : ''}
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
      <button class="action-btn download-btn" data-action="download" data-url="${zipUrl}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg> ${t.popup_action_download}
      </button>
      <button class="action-btn secondary-btn" data-action="copy" data-url="${zipUrl}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ${t.popup_action_copy}
      </button>
    `;
  }

  if (status === TASK_STATUS.FAILED) {
    return `
      <button class="action-btn retry-btn" data-action="retry" data-task-id="${task.id}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/></svg> ${t.popup_action_retry}
      </button>
    `;
  }

  return `<span class="action-placeholder">${t.popup_status_processing}...</span>`;
}

