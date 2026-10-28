// Background Service Worker

import converter from '@core/converter';
import ar5ivConverter from '@core/converter/ar5iv-converter';
import taskManager from '@core/task-manager';
import logger from '@utils/logger';
import storage from '@utils/storage';
import { TASK_STATUS } from '@config/constants';
import { arxivApiUrl } from '@core/metadata-extractor';
import { deletedTaskGuard, processMinerUTaskInBackground } from './mineru-task-runner';
import { KEEP_ALIVE_ALARM, syncKeepAlive } from './keep-alive';
import { isTrustedArxivSender, isValidArxivId, triggerConversionInActiveTab } from './message-guards';
import { createActionBadge, handleShortcutResult, conversionSucceeded } from './action-badge';

const actionBadge = createActionBadge(chrome.action);
if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info && info.status === 'loading') actionBadge.tabLoading(tabId);
  });
}
// Round 3：worker 重启 / 浏览器启动时清掉丢了计时器的残留徽标
actionBadge.sweep(chrome.tabs);
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(() => actionBadge.sweep(chrome.tabs));

logger.info('Background service worker initialized');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Received message:', message);

  switch (message.type) {
  case 'CONVERT_PAPER':
    handleConvertPaper(message.data, sendResponse, sender);
    return true;

  case 'SHORTCUT_RESULT':
    handleShortcutResult(actionBadge, message, sender, chrome.runtime.id);
    return false;

  case 'DOWNLOAD_PDF':
    handleDownloadPdf(message.data, sendResponse, sender);
    return true;

  case 'FETCH_ARXIV_API':
    if (!isTrustedArxivSender(sender, chrome.runtime.id)) {
      logger.warn('FETCH_ARXIV_API rejected: untrusted sender', sender && sender.url);
      sendResponse({ success: false, error: 'Untrusted sender' });
      return false;
    }
    handleFetchArxivApi(message.arxivId, sendResponse);
    return true;

  case 'CHECK_AR5IV':
    handleCheckAr5iv(message.data, sendResponse);
    return true;

  case 'GET_STATISTICS':
    handleGetStatistics(sendResponse);
    return true;

  case 'START_MINERU_TASK':
    handleStartMinerUTask(message.data, sendResponse);
    return true;

  case 'START_MINERU_TASK_FORCE':
    // 强制创建任务，跳过重复检查
    handleStartMinerUTaskForce(message.data, sendResponse);
    return true;

  case 'GET_TASKS':
    handleGetTasks(sendResponse);
    return true;

  case 'DELETE_TASK':
    handleDeleteTask(message.taskId, sendResponse);
    return true;

  case 'RETRY_TASK':
    handleRetryTask(message.taskId, sendResponse);
    return true;

  case 'CLEAR_COMPLETED_TASKS':
    handleClearCompletedTasks(sendResponse);
    return true;

  case '_INTERNAL_PROCESS_TASK':
    // 内部消息：触发任务处理（从 converter 调用）
    if (message.taskId) {
      processMinerUTaskInBackground(message.taskId);
      refreshKeepAlive();
    }
    return false;

  case 'PING':
    sendResponse({ success: true, message: 'pong' });
    return false;

  default:
    logger.warn('Unknown message type:', message.type);
    sendResponse({ success: false, error: 'Unknown message type' });
    return false;
  }
});

async function handleFetchArxivApi(arxivId, sendResponse) {
  try {
    if (!isValidArxivId(arxivId)) throw new Error('Invalid arXiv ID');
    const response = await fetch(arxivApiUrl(arxivId));
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    sendResponse({ success: true, xml: await response.text() });
  } catch (error) {
    logger.warn('arXiv API request failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleConvertPaper(paperInfo, sendResponse, sender) {
  logger.info('Handling convert request:', paperInfo);
  const tabId = sender?.tab?.id;

  try {
    const progressCallback = (progress) => {
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, { type: 'CONVERSION_PROGRESS', data: progress })
          .catch(() => logger.debug('Failed to send progress update to tab'));
      }
    };

    const result = await converter.convert(paperInfo, progressCallback, tabId);

    // 如果返回的是重复任务标志，将其传递给前端
    if (result && result.duplicate) {
      sendResponse({
        success: false,
        duplicate: true,
        existingTask: result.existingTask
      });
    } else {
      sendResponse({ success: true, data: result });
    }
    // H-01：MainConverter 多数失败返回 { success:false } 而不抛异常，按结果决定「✓」还是「!」
    if (result && result.duplicate) actionBadge.hold(tabId);
    else actionBadge.finish(tabId, conversionSucceeded(result));
  } catch (error) {
    logger.error('Conversion failed:', error);
    actionBadge.finish(tabId, false);
    sendResponse({ success: false, error: error.message || 'Unknown error' });
  }
}

async function handleDownloadPdf(paperInfo, sendResponse, sender) {
  logger.info('Handling PDF download request:', paperInfo);
  const tabId = sender?.tab?.id;

  try {
    const result = await converter.downloadPdf(paperInfo, tabId);
    sendResponse({ success: true, data: result });
  } catch (error) {
    logger.error('PDF download failed:', error);
    sendResponse({ success: false, error: error.message || 'Unknown error' });
  }
}

async function handleGetStatistics(sendResponse) {
  try {
    const stats = await storage.getStatistics();
    sendResponse({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get statistics:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCheckAr5iv(arxivId, sendResponse) {
  logger.debug('Checking HTML availability for:', arxivId);
  try {
    const available = await ar5ivConverter.checkAvailability(arxivId);
    sendResponse({ success: true, available });
  } catch (error) {
    logger.error('Failed to check HTML availability:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// MinerU 后台任务处理
// ============================================

/**
 * MinerU 后台任务创建的内部实现
 * @param {Object} paperInfo - 论文信息
 * @param {Function} sendResponse - 消息响应函数
 * @param {boolean} skipDuplicateCheck - 是否跳过重复任务检查
 */
async function _doStartMinerUTask(paperInfo, sendResponse, skipDuplicateCheck) {
  try {
    if (!skipDuplicateCheck) {
      const existingTask = await taskManager.findTaskByArxivId(paperInfo.arxivId);
      if (existingTask) {
        sendResponse({
          success: false,
          duplicate: true,
          existingTask: {
            id: existingTask.id,
            status: existingTask.status,
            arxivId: existingTask.paperInfo.arxivId,
            title: existingTask.paperInfo.title,
          }
        });
        return;
      }
    }

    const task = await taskManager.addTask(paperInfo, 'mineru');
    sendResponse({ success: true, taskId: task.id });

    // 立即异步处理任务（不阻塞响应）
    // 使用 Promise.resolve().then() 而非 setImmediate（浏览器兼容）
    Promise.resolve().then(() => {
      processMinerUTaskInBackground(task.id);
      refreshKeepAlive();
    });
  } catch (error) {
    logger.error('Failed to start MinerU task:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 启动 MinerU 后台任务
 */
async function handleStartMinerUTask(paperInfo, sendResponse) {
  logger.info('Starting MinerU background task:', paperInfo.arxivId);
  return _doStartMinerUTask(paperInfo, sendResponse, false);
}

/**
 * 强制启动 MinerU 后台任务（跳过重复检查）
 */
async function handleStartMinerUTaskForce(paperInfo, sendResponse) {
  logger.info('Force starting MinerU background task:', paperInfo.arxivId);
  return _doStartMinerUTask(paperInfo, sendResponse, true);
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
    logger.error('Failed to get tasks:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 删除任务
 */
async function handleDeleteTask(taskId, sendResponse) {
  try {
    // 先落盘删除标记，再删任务记录，避免 service worker 在两步之间重启后继续下载
    await deletedTaskGuard.mark(taskId);

    const success = await taskManager.deleteTask(taskId);
    sendResponse({ success });
  } catch (error) {
    logger.error('Failed to delete task:', error);
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
      sendResponse({ success: false, error: '任务不存在' });
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
    refreshKeepAlive();
  } catch (error) {
    logger.error('Failed to retry task:', error);
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
    logger.error('Failed to clear completed tasks:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 监听通知点击事件
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('mineru_task_')) {
    // 打开 Popup 显示任务列表
    chrome.action.openPopup();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // 首次安装，打开欢迎页面
    chrome.tabs.create({
      url: 'settings.html?welcome=true',
    });
  } else if (details.reason === 'update') {
    logger.info('Updated to version:', chrome.runtime.getManifest().version);
  }
});

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    logger.debug('Command received:', command);

    if (command === 'convert-current-paper') {
      // 向当前 Tab 发送转换指令；非 arXiv 页没有 content script，错误在内部吞掉
      triggerConversionInActiveTab(chrome.tabs, chrome.runtime, (msg) => logger.debug(msg), {
        onSent: (tabId) => actionBadge.shortcutStarted(tabId),
        onUndelivered: (tabId) => actionBadge.shortcutUndelivered(tabId),
      });
    }
  });
} else {
  logger.warn('chrome.commands API not available');
}

// 仅在有进行中的 MinerU 任务时保持 Service Worker 活跃，空闲时清除 alarm
async function refreshKeepAlive() {
  try {
    await syncKeepAlive(chrome.alarms, await taskManager.getStatistics());
  } catch (error) {
    logger.warn('Failed to sync keep-alive alarm:', error);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    refreshKeepAlive();
  }
});
refreshKeepAlive();

// 导出函数供其他模块使用
export { processMinerUTaskInBackground };
