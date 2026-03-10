// Popup UI - MinerU 任务中心

import logger from '@utils/logger';
import storage from '@utils/storage';
import { translations } from '@config/locales';
import { TASK_STATUS } from '@config/constants';

let currentTasks = [];
let currentLang = 'en';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  logger.debug('Popup task center initialized');

  // 初始化语言
  await initLanguage();

  // 绑定按钮事件
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document
    .getElementById('clearCompletedBtn')
    .addEventListener('click', clearCompleted);
  document.getElementById('refreshBtn').addEventListener('click', loadTasks);

  // 绑定任务操作事件（只绑定一次，使用事件委托）
  bindTaskActions();

  // 加载任务
  await loadTasks();

  // 监听任务变化
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.mineruTasks) {
      loadTasks();
    }
    // 监听语言变化
    if (area === 'sync' && changes.language) {
      updateLanguage(changes.language.newValue);
    }
  });
}

/**
 * 初始化语言
 */
async function initLanguage() {
  const lang = await storage.getLanguage();
  updateLanguage(lang);
}

/**
 * 更新语言
 */
function updateLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];

  // 更新所有带 data-i18n 属性的元素
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  // 更新 title 属性
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) {
      el.title = t[key];
    }
  });

  // 更新 aria-label
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (t[key]) {
      el.setAttribute('aria-label', t[key]);
    }
  });

  // 重新渲染任务列表以更新翻译
  if (currentTasks.length > 0) {
    renderTaskList(currentTasks);
  }
}

/**
 * 加载任务列表
 */
async function loadTasks() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TASKS' });

    if (response && response.success) {
      currentTasks = response.tasks || [];
      const stats = response.stats || {};

      // 更新统计信息
      updateStats(stats);

      // 渲染任务列表
      renderTaskList(currentTasks);
    } else {
      logger.error('Failed to load tasks:', response?.error);
    }
  } catch (error) {
    logger.error('Failed to load tasks:', error);
  }
}

/**
 * 更新统计信息
 */
function updateStats(stats) {
  document.getElementById('statsTotal').textContent = stats.total || 0;
  document.getElementById('statsProcessing').textContent =
    stats.processing || 0;
  document.getElementById('statsCompleted').textContent = stats.completed || 0;
}

/**
 * 渲染任务列表
 */
function renderTaskList(tasks) {
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
function createTaskCard(task) {
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
        <button class="delete-btn" data-action="delete" data-task-id="${id}" title="${translations[currentLang].popup_action_delete}">×</button>
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
function getStatusDisplay(status) {
  const t = translations[currentLang];
  const displays = {
    [TASK_STATUS.PENDING]: {
      icon: '⏳',
      text: t.popup_status_pending || 'Pending',
    },
    [TASK_STATUS.PROCESSING]: {
      icon: '🔄',
      text: t.popup_status_processing || 'Processing',
    },
    [TASK_STATUS.COMPLETED]: {
      icon: '✅',
      text: t.popup_status_completed || 'Completed',
    },
    [TASK_STATUS.FAILED]: {
      icon: '❌',
      text: t.popup_status_failed || 'Failed',
    },
  };
  return (
    displays[status] || { icon: '❓', text: t.popup_status_unknown || 'Unknown' }
  );
}

/**
 * 获取任务操作按钮
 */
function getTaskActions(task) {
  const { status, zipUrl } = task;
  const t = translations[currentLang];

  if (status === TASK_STATUS.COMPLETED && zipUrl) {
    return `
      <button class="action-btn download-btn" data-action="download" data-url="${zipUrl}">
        📥 ${t.popup_action_download}
      </button>
      <button class="action-btn secondary-btn" data-action="copy" data-url="${zipUrl}">
        📋 ${t.popup_action_copy}
      </button>
    `;
  }

  if (status === TASK_STATUS.FAILED) {
    return `
      <button class="action-btn retry-btn" data-action="retry" data-task-id="${task.id}">
        🔄 ${t.popup_action_retry}
      </button>
    `;
  }

  return `<span class="action-placeholder">${t.popup_status_processing}...</span>`;
}

/**
 * 绑定任务操作事件
 */
function bindTaskActions() {
  // 使用事件委托
  const listEl = document.getElementById('taskList');

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const taskId = btn.dataset.taskId;
    const url = btn.dataset.url;

    switch (action) {
    case 'download':
      handleDownload(url);
      break;

    case 'copy':
      handleCopyLink(url);
      break;

    case 'retry':
      await handleRetry(taskId);
      break;

    case 'delete':
      await handleDelete(taskId);
      break;
    }
  });
}

/**
 * 处理下载
 */
function handleDownload(url) {
  chrome.downloads.download({ url }, (downloadId) => {
    if (chrome.runtime.lastError) {
      logger.error('Download failed:', chrome.runtime.lastError);
    } else {
      logger.info('Download started:', downloadId);
    }
  });
}

/**
 * 复制下载链接
 */
async function handleCopyLink(url) {
  const t = translations[currentLang];
  try {
    await navigator.clipboard.writeText(url);
    showToast(t.popup_toast_link_copied);
  } catch (error) {
    logger.error('Failed to copy link:', error);
    showToast(t.popup_toast_copy_failed);
  }
}

/**
 * 重试任务
 */
async function handleRetry(taskId) {
  const t = translations[currentLang];
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'RETRY_TASK',
      taskId,
    });

    if (response && response.success) {
      showToast(t.popup_toast_retry_success);
      await loadTasks();
    } else {
      showToast(t.popup_toast_retry_failed);
    }
  } catch (error) {
    logger.error('Failed to retry task:', error);
    showToast(t.popup_toast_retry_failed);
  }
}

/**
 * 显示自定义确认对话框
 * @returns {Promise<boolean>}
 */
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmOverlay');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    msgEl.textContent = message;
    overlay.classList.add('show');

    const cleanup = () => {
      overlay.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

/**
 * 删除任务
 */
async function handleDelete(taskId) {
  const t = translations[currentLang];
  const confirmed = await showConfirm(t.popup_confirm_delete);
  if (!confirmed) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_TASK',
      taskId,
    });

    if (response && response.success) {
      showToast(t.popup_toast_delete_success);
      await loadTasks();
    } else {
      showToast(t.popup_toast_delete_failed);
    }
  } catch (error) {
    logger.error('Failed to delete task:', error);
    showToast(t.popup_toast_delete_failed);
  }
}

/**
 * 清空已完成的任务
 */
async function clearCompleted() {
  const t = translations[currentLang];
  const confirmed = await showConfirm(t.popup_confirm_clear);
  if (!confirmed) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_COMPLETED_TASKS',
    });

    if (response && response.success) {
      showToast(t.popup_toast_clear_success.replace('{n}', response.cleared));
      await loadTasks();
    } else {
      showToast(t.popup_toast_clear_failed);
    }
  } catch (error) {
    logger.error('Failed to clear completed tasks:', error);
    showToast(t.popup_toast_clear_failed);
  }
}

/**
 * 打开设置页面
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
  window.close();
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
 * 显示提示消息
 */
function showToast(message) {
  // 简单实现：使用alert，可以后续优化为自定义toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
