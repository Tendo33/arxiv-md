// Popup UI - MinerU 任务中心

import logger from "@utils/logger";
import { TASK_STATUS } from "@config/constants";

let currentTasks = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  logger.debug("Popup task center initialized");

  // 绑定按钮事件
  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("clearCompletedBtn").addEventListener("click", clearCompleted);
  document.getElementById("refreshBtn").addEventListener("click", loadTasks);

  // 绑定任务操作事件（只绑定一次，使用事件委托）
  bindTaskActions();

  // 加载任务
  await loadTasks();

  // 监听任务变化
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.mineruTasks) {
      loadTasks();
    }
  });
}

/**
 * 加载任务列表
 */
async function loadTasks() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_TASKS" });

    if (response && response.success) {
      currentTasks = response.tasks || [];
      const stats = response.stats || {};

      // 更新统计信息
      updateStats(stats);

      // 渲染任务列表
      renderTaskList(currentTasks);
    } else {
      logger.error("Failed to load tasks:", response?.error);
    }
  } catch (error) {
    logger.error("Failed to load tasks:", error);
  }
}

/**
 * 更新统计信息
 */
function updateStats(stats) {
  document.getElementById("statsTotal").textContent = stats.total || 0;
  document.getElementById("statsProcessing").textContent = stats.processing || 0;
  document.getElementById("statsCompleted").textContent = stats.completed || 0;
}

/**
 * 渲染任务列表
 */
function renderTaskList(tasks) {
  const listEl = document.getElementById("taskList");
  const emptyStateEl = document.getElementById("emptyState");

  if (!tasks || tasks.length === 0) {
    listEl.innerHTML = "";
    emptyStateEl.style.display = "flex";
    return;
  }

  emptyStateEl.style.display = "none";

  // 按创建时间倒序排列（最新的在前）
  const sortedTasks = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

  listEl.innerHTML = sortedTasks.map(createTaskCard).join("");
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
  const truncatedTitle = title.length > 50 ? title.substring(0, 50) + "..." : title;
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
      : "";

  // 操作按钮
  const actions = getTaskActions(task);

  return `
    <div class="task-card" data-task-id="${id}" data-status="${status}">
      <div class="task-header">
        <div class="task-status status-${status}">
          <span class="status-icon">${statusDisplay.icon}</span>
          <span class="status-text">${statusDisplay.text}</span>
        </div>
        <button class="delete-btn" data-action="delete" data-task-id="${id}" title="删除">×</button>
      </div>
      
      <div class="task-content">
        <h3 class="task-title" title="${title}">${truncatedTitle}</h3>
        <div class="task-meta">
          <span class="meta-id">${paperInfo.arxivId}</span>
          <span class="meta-time">${timeAgo}</span>
        </div>
        ${error ? `<div class="task-error">❌ ${error}</div>` : ""}
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
  const displays = {
    [TASK_STATUS.PENDING]: { icon: "⏳", text: "等待处理" },
    [TASK_STATUS.PROCESSING]: { icon: "🔄", text: "处理中" },
    [TASK_STATUS.COMPLETED]: { icon: "✅", text: "已完成" },
    [TASK_STATUS.FAILED]: { icon: "❌", text: "失败" },
  };
  return displays[status] || { icon: "❓", text: "未知" };
}

/**
 * 获取任务操作按钮
 */
function getTaskActions(task) {
  const { status, zipUrl } = task;

  if (status === TASK_STATUS.COMPLETED && zipUrl) {
    return `
      <button class="action-btn download-btn" data-action="download" data-url="${zipUrl}">
        📥 下载
      </button>
      <button class="action-btn secondary-btn" data-action="copy" data-url="${zipUrl}">
        📋 复制链接
      </button>
    `;
  }

  if (status === TASK_STATUS.FAILED) {
    return `
      <button class="action-btn retry-btn" data-action="retry" data-task-id="${task.id}">
        🔄 重试
      </button>
    `;
  }

  return '<span class="action-placeholder">处理中...</span>';
}

/**
 * 绑定任务操作事件
 */
function bindTaskActions() {
  // 使用事件委托
  const listEl = document.getElementById("taskList");

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const taskId = btn.dataset.taskId;
    const url = btn.dataset.url;

    switch (action) {
      case "download":
        handleDownload(url);
        break;

      case "copy":
        handleCopyLink(url);
        break;

      case "retry":
        await handleRetry(taskId);
        break;

      case "delete":
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
      logger.error("Download failed:", chrome.runtime.lastError);
    } else {
      logger.info("Download started:", downloadId);
    }
  });
}

/**
 * 复制下载链接
 */
async function handleCopyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast("✅ 链接已复制");
  } catch (error) {
    logger.error("Failed to copy link:", error);
    showToast("❌ 复制失败");
  }
}

/**
 * 重试任务
 */
async function handleRetry(taskId) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "RETRY_TASK",
      taskId,
    });

    if (response && response.success) {
      showToast("✅ 任务已重新提交");
      await loadTasks();
    } else {
      showToast("❌ 重试失败");
    }
  } catch (error) {
    logger.error("Failed to retry task:", error);
    showToast("❌ 重试失败");
  }
}

/**
 * 删除任务
 */
async function handleDelete(taskId) {
  if (!confirm("确定要删除这个任务吗？")) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "DELETE_TASK",
      taskId,
    });

    if (response && response.success) {
      showToast("✅ 任务已删除");
      await loadTasks();
    } else {
      showToast("❌ 删除失败");
    }
  } catch (error) {
    logger.error("Failed to delete task:", error);
    showToast("❌ 删除失败");
  }
}

/**
 * 清空已完成的任务
 */
async function clearCompleted() {
  if (!confirm("确定要清空所有已完成和失败的任务吗？")) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "CLEAR_COMPLETED_TASKS",
    });

    if (response && response.success) {
      showToast(`✅ 已清空 ${response.cleared} 个任务`);
      await loadTasks();
    } else {
      showToast("❌ 清空失败");
    }
  } catch (error) {
    logger.error("Failed to clear completed tasks:", error);
    showToast("❌ 清空失败");
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
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

/**
 * 显示提示消息
 */
function showToast(message) {
  // 简单实现：使用alert，可以后续优化为自定义toast
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
