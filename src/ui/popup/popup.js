// Popup UI - MinerU 任务中心

import logger from '@utils/logger';
import storage from '@utils/storage';
import { translations } from '@config/locales';
import { showConfirm } from './confirm-dialog';
import { renderTaskList, setTaskListLanguage } from './task-list';

let currentTasks = [];
let currentLang = 'en';
let reloadTimer = null;

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
      scheduleLoadTasks();
    }
    // 监听语言变化
    if (area === 'sync' && changes.language) {
      updateLanguage(changes.language.newValue);
    }
  });
}

function scheduleLoadTasks() {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
  }
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    loadTasks();
  }, 120);
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
  setTaskListLanguage(lang);
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
 * 显示提示消息
 */
function showToast(message) {
  // 简单实现：使用alert，可以后续优化为自定义toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
