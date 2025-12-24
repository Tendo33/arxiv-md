// Background Service Worker

import converter from "@core/converter";
import ar5ivConverter from "@core/converter/ar5iv-converter";
import mineruClient from "@core/converter/mineru-client";
import taskManager from "@core/task-manager";
import logger from "@utils/logger";
import { generateFilename } from "@utils/helpers";
import storage from "@utils/storage";
import { TASK_STATUS } from "@config/constants";

logger.info("Background service worker initialized");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug("Received message:", message);

  switch (message.type) {
    case "CONVERT_PAPER":
      handleConvertPaper(message.data, sendResponse, sender);
      return true;

    case "DOWNLOAD_PDF":
      handleDownloadPdf(message.data, sendResponse, sender);
      return true;

    case "CHECK_AR5IV":
      handleCheckAr5iv(message.data, sendResponse);
      return true;

    case "GET_STATISTICS":
      handleGetStatistics(sendResponse);
      return true;

    case "START_MINERU_TASK":
      handleStartMinerUTask(message.data, sendResponse);
      return true;

    case "GET_TASKS":
      handleGetTasks(sendResponse);
      return true;

    case "DELETE_TASK":
      handleDeleteTask(message.taskId, sendResponse);
      return true;

    case "RETRY_TASK":
      handleRetryTask(message.taskId, sendResponse);
      return true;

    case "CLEAR_COMPLETED_TASKS":
      handleClearCompletedTasks(sendResponse);
      return true;

    case "_INTERNAL_PROCESS_TASK":
      // 内部消息：触发任务处理（从 converter 调用）
      if (message.taskId) {
        processMinerUTaskInBackground(message.taskId);
      }
      return false;

    case "PING":
      sendResponse({ success: true, message: "pong" });
      return false;

    default:
      logger.warn("Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
      return false;
  }
});

async function handleConvertPaper(paperInfo, sendResponse, sender) {
  logger.info("Handling convert request:", paperInfo);
  const tabId = sender?.tab?.id;

  try {
    const progressCallback = (progress) => {
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, { type: "CONVERSION_PROGRESS", data: progress })
          .catch(() => logger.debug("Failed to send progress update to tab"));
      }
    };

    const result = await converter.convert(paperInfo, progressCallback, tabId);
    sendResponse({ success: true, data: result });
  } catch (error) {
    logger.error("Conversion failed:", error);
    sendResponse({ success: false, error: error.message || "Unknown error" });
  }
}

async function handleDownloadPdf(paperInfo, sendResponse, sender) {
  logger.info("Handling PDF download request:", paperInfo);
  const tabId = sender?.tab?.id;

  try {
    const result = await converter.downloadPdf(paperInfo, tabId);
    sendResponse({ success: true, data: result });
  } catch (error) {
    logger.error("PDF download failed:", error);
    sendResponse({ success: false, error: error.message || "Unknown error" });
  }
}

async function handleGetStatistics(sendResponse) {
  try {
    const stats = await storage.getStatistics();
    sendResponse({ success: true, data: stats });
  } catch (error) {
    logger.error("Failed to get statistics:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCheckAr5iv(arxivId, sendResponse) {
  logger.debug("Checking ar5iv availability for:", arxivId);
  try {
    const available = await ar5ivConverter.checkAvailability(arxivId);
    sendResponse({ success: true, available });
  } catch (error) {
    logger.error("Failed to check ar5iv availability:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// MinerU 后台任务处理
// ============================================

/**
 * 启动 MinerU 后台任务
 */
async function handleStartMinerUTask(paperInfo, sendResponse) {
  logger.info("Starting MinerU background task:", paperInfo.arxivId);

  try {
    // 创建任务
    const task = await taskManager.addTask(paperInfo, "mineru");
    sendResponse({ success: true, taskId: task.id });

    // 立即异步处理任务（不阻塞响应）
    // 使用 Promise.resolve().then() 而非 setImmediate（浏览器兼容）
    Promise.resolve().then(() => {
      processMinerUTaskInBackground(task.id);
    });
  } catch (error) {
    logger.error("Failed to start MinerU task:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 后台处理 MinerU 任务
 */
async function processMinerUTaskInBackground(taskId) {
  logger.info("Processing MinerU task in background:", taskId);

  const task = await taskManager.getTask(taskId);
  if (!task) {
    logger.error("Task not found:", taskId);
    return;
  }

  const token = await storage.getMinerUToken();
  if (!token) {
    logger.error("MinerU Token not configured");
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.FAILED,
      error: "未配置 MinerU API Token",
    });
    showTaskNotification(task, "failed", "未配置 MinerU Token");
    return;
  }

  try {
    logger.info("Starting MinerU API call for task:", taskId);

    // 更新为处理中
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.PROCESSING,
      progress: 0,
    });

    // 调用 MinerU API
    const pdfUrl = task.paperInfo.pdfUrl || `https://arxiv.org/pdf/${task.paperInfo.arxivId}.pdf`;
    logger.info("PDF URL:", pdfUrl);

    // 生成统一格式的文件名（与其他功能保持一致）
    const paperInfo = task.paperInfo;
    const filename = generateFilename(
      {
        title: paperInfo.title,
        authors: paperInfo.authors,
        year: paperInfo.year,
        arxivId: paperInfo.arxivId,
      },
      "zip"
    );

    const result = await mineruClient.convert(
      pdfUrl,
      token,
      { ...paperInfo, filename },
      async (progress) => {
        // 实时更新进度
        logger.debug(`Task ${taskId} progress:`, progress.progress);
        await taskManager.updateTask(taskId, {
          progress: Math.round(progress.progress || 0),
        });
      }
    );

    logger.info("MinerU API call completed for task:", taskId);

    // 标记为完成
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.COMPLETED,
      progress: 100,
      zipUrl: result.zipUrl,
      downloadId: result.downloadId,
      taskId: result.metadata.taskId,
      completedAt: Date.now(),
    });

    // 增加统计
    await storage.incrementConversion("mineru_api");

    // 发送成功通知
    showTaskNotification(task, "completed", result.zipUrl);
    logger.info("MinerU task completed:", taskId);
  } catch (error) {
    logger.error("MinerU task failed:", taskId, error);
    logger.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // 标记为失败
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.FAILED,
      error: error.message || "未知错误",
    });

    // 发送失败通知
    showTaskNotification(task, "failed", error.message);
  }
}

/**
 * 显示任务通知
 */
function showTaskNotification(task, status, detail = "") {
  const title = task.paperInfo.title || task.paperInfo.arxivId;
  const truncatedTitle = title.length > 40 ? title.substring(0, 40) + "..." : title;

  let notificationConfig = {
    type: "basic",
    iconUrl: "/assets/icon-128.png",
  };

  if (status === "completed") {
    notificationConfig.title = "✅ MinerU 转换完成";
    notificationConfig.message = `${truncatedTitle}\n\n点击查看下载链接`;
    notificationConfig.buttons = [{ title: "查看任务" }];
  } else if (status === "failed") {
    notificationConfig.title = "❌ MinerU 转换失败";
    notificationConfig.message = `${truncatedTitle}\n\n${detail || "未知错误"}`;
  }

  chrome.notifications.create(
    `mineru_task_${task.id}`,
    notificationConfig,
    (notificationId) => {
      if (chrome.runtime.lastError) {
        logger.error("Failed to create notification:", chrome.runtime.lastError);
      } else {
        logger.debug("Notification created:", notificationId);
      }
    }
  );
}

/**
 * 获取任务列表
 */
async function handleGetTasks(sendResponse) {
  try {
    const tasks = await taskManager.getTasks();
    const stats = await taskManager.getStatistics();
    sendResponse({ success: true, tasks, stats });
  } catch (error) {
    logger.error("Failed to get tasks:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 删除任务
 */
async function handleDeleteTask(taskId, sendResponse) {
  try {
    const success = await taskManager.deleteTask(taskId);
    sendResponse({ success });
  } catch (error) {
    logger.error("Failed to delete task:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 重试任务
 */
async function handleRetryTask(taskId, sendResponse) {
  try {
    const task = await taskManager.getTask(taskId);
    if (!task) {
      sendResponse({ success: false, error: "任务不存在" });
      return;
    }

    // 重置任务状态
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.PENDING,
      progress: 0,
      error: null,
    });

    sendResponse({ success: true });

    // 重新处理
    processMinerUTaskInBackground(taskId);
  } catch (error) {
    logger.error("Failed to retry task:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 清空已完成的任务
 */
async function handleClearCompletedTasks(sendResponse) {
  try {
    const count = await taskManager.clearCompletedTasks();
    sendResponse({ success: true, cleared: count });
  } catch (error) {
    logger.error("Failed to clear completed tasks:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 监听通知点击事件
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("mineru_task_")) {
    // 打开 Popup 显示任务列表
    chrome.action.openPopup();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  logger.info("Extension installed/updated:", details.reason);

  if (details.reason === "install") {
    // 首次安装，打开欢迎页面
    chrome.tabs.create({
      url: "settings.html?welcome=true",
    });
  } else if (details.reason === "update") {
    logger.info("Updated to version:", chrome.runtime.getManifest().version);
  }
});

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    logger.debug("Command received:", command);

    if (command === "convert-current-paper") {
      // 向当前 Tab 发送转换指令
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "TRIGGER_CONVERSION",
          });
        }
      });
    }
  });
} else {
  logger.warn("chrome.commands API not available");
}

// 保持 Service Worker 活跃
setInterval(() => logger.debug("Keep alive ping"), 20000);

// 导出函数供其他模块使用
export { processMinerUTaskInBackground };
