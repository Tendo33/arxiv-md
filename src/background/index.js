// Background Service Worker

import { isDisclosureAcked } from '@utils/disclosure-ack';
import { openDisclosureSettings } from '@core/converter/index';
import converter from '@core/converter';
import ar5ivConverter from '@core/converter/ar5iv-converter';
import taskManager from '@core/task-manager';
import logger from '@utils/logger';
import storage from '@utils/storage';
import { TASK_STATUS } from '@config/constants';
import { arxivApiUrl } from '@core/metadata-extractor';
import { installPaddleOriginRuleListeners } from './paddle-origin-rule';
import { deletedTaskGuard, processMinerUTaskInBackground, providerRegistry, resumeParseTasks, confirmPdfSend, abortParseTask } from './mineru-task-runner';
import { KEEP_ALIVE_ALARM, syncKeepAlive } from './keep-alive';
import { handleOpenDisclosure, isExtensionPageSender, isTrustedArxivSender, isValidArxivId, triggerConversionInActiveTab } from './message-guards';
import { createActionBadge, handleShortcutResult, conversionBadgeState } from './action-badge';
import { createContextMenus } from './context-menu';
import { runMigrations } from '@utils/migrations';

const actionBadge = createActionBadge(chrome.action);
if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info && info.status === 'loading') actionBadge.tabLoading(tabId);
  });
}
// Round 3：worker 重启 / 浏览器启动时清掉丢了计时器的残留徽标
actionBadge.sweep(chrome.tabs);
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(() => actionBadge.sweep(chrome.tabs));

// Round 3 C-3：右键菜单。onInstalled 建一次；语言 / Token 变化时重建，文案和置灰状态跟着变
const contextMenus = chrome.contextMenus ? createContextMenus({
  menus: chrome.contextMenus, tabs: chrome.tabs, runtime: chrome.runtime, commands: chrome.commands,
  storage, isValidArxivId, badge: actionBadge, log: (m) => logger.debug(m),
}) : null;
if (contextMenus) {
  chrome.runtime.onInstalled.addListener(() => contextMenus.refresh());
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(() => contextMenus.refresh());
  chrome.contextMenus.onClicked.addListener((info, tab) => contextMenus.onClicked(info, tab));
  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === 'sync' && (changes.language || changes.pdfProvider)) || (area === 'local' && changes.providerKeys)) contextMenus.refresh();
  });
}

// R4-05：老配置迁移。onInstalled(update) 跑一次；SW 每次启动也跑（幂等，已是最新版本时直接返回），
// 保证中途失败后下次启动能补上。迁移完成后刷新右键菜单（Token 位置变了）。
const migrationsReady = runMigrations(chrome.storage)
  .then((r) => { if (r.ran) logger.info('Storage migrated:', r); if (r.ran && contextMenus) contextMenus.refresh(); return r; })
  .catch((e) => { logger.error('Storage migration failed, will retry on next start:', e); return null; });
chrome.runtime.onInstalled.addListener(() => { migrationsReady.then(() => runMigrations(chrome.storage)).catch(() => {}); });

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

  case 'OPEN_DISCLOSURE':
    // 附录 C10：content script 请求打开设置页的数据说明（只接受已知后端 id，由 disclosureHash 校验格式）
    // P3-5：同时核对发送方（本扩展、arxiv.org 或扩展页面）
    if (!handleOpenDisclosure(message, sender, chrome.runtime.id, openDisclosureSettings)) logger.warn('OPEN_DISCLOSURE rejected');
    return false;

  case 'START_PDF_TASK':
    // R4-11：通用入口 {data: paperInfo, provider?, force?}
    _doStartPdfTask(message.data, sendResponse, !!message.force, message.provider);
    return true;

  case 'START_MINERU_TASK':
    // 旧消息名（别名）：走当前 PDF 后端
    handleStartMinerUTask(message.data, sendResponse);
    return true;

  case 'START_MINERU_TASK_FORCE':
    // 强制创建任务，跳过重复检查
    handleStartMinerUTaskForce(message.data, sendResponse);
    return true;

  case 'CONFIRM_PDF_SEND':
    // 审查 P1-1：非 OA PDF 用户确认后才发送；只接受扩展页面发来的确认
    if (!isExtensionPageSender(sender, chrome.runtime.id)) {
      logger.warn('CONFIRM_PDF_SEND rejected: untrusted sender', sender && sender.url);
      sendResponse({ success: false, error: 'Untrusted sender' });
      return false;
    }
    confirmPdfSend(message.taskId)
      .then((r) => { refreshKeepAlive(); sendResponse({ success: !!(r && r.confirmed), skipped: r && r.skipped }); })
      .catch((e) => sendResponse({ success: false, error: e && e.message }));
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
      startParseTask(message.taskId);
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
    else actionBadge.finish(tabId, conversionBadgeState(result));
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
async function resolvePdfProvider(requested) {
  if (requested && providerRegistry.has(requested)) return requested;
  // R4-13：已选 → 用它；老用户有 MinerU token → mineru；否则 paddleocr
  return storage.getPdfProvider((id) => providerRegistry.has(id));
}

async function _doStartPdfTask(paperInfo, sendResponse, skipDuplicateCheck, requestedProvider) {
  try {
    const provider = await resolvePdfProvider(requestedProvider);
    // 附录 C10：没确认过数据说明 → 不建任务、不发请求，打开设置页
    if (!(await isDisclosureAcked(provider))) {
      openDisclosureSettings(provider);
      sendResponse({ success: false, disclosureNeeded: true, provider, error: 'DISCLOSURE_NEEDED' });
      return;
    }
    if (!skipDuplicateCheck) {
      const existingTask = await taskManager.findTaskByArxivId(paperInfo.arxivId, provider);
      if (existingTask) {
        sendResponse({
          success: false,
          duplicate: true,
          existingTask: {
            id: existingTask.id,
            status: existingTask.status,
            arxivId: existingTask.paperInfo.arxivId,
            title: existingTask.paperInfo.title,
            provider: existingTask.provider,
          }
        });
        return;
      }
    }

    const task = await taskManager.addTask(paperInfo, 'mineru', provider);
    sendResponse({ success: true, taskId: task.id, provider });

    // 立即异步处理任务（不阻塞响应）
    Promise.resolve().then(() => {
      startParseTask(task.id);
    });
  } catch (error) {
    logger.error('Failed to start PDF task:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function _doStartMinerUTask(paperInfo, sendResponse, skipDuplicateCheck) {
  return _doStartPdfTask(paperInfo, sendResponse, skipDuplicateCheck, null);
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
    abortParseTask(taskId); // 审查 P2-3：进行中的发送立即中止

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
      errorCode: null,
      errorReason: null,
      jobId: null, // 重试 = 重新提交
      startedAt: null,
      submitStartedAt: null,
      // 审查 P3-4：手动重试 = 重新开始，清掉上一轮「等 DNR 重载」的状态（否则 popup 一直显示等待提示、不再自动重载、10 分钟窗口用旧值）
      dnrReinitWaitSince: null,
      dnrAutoReinit: null,
    });

    sendResponse({ success: true });

    // QA 6a49976 R-4：没确认数据说明就点重试 → 和新建任务一样重新打开披露页（任务由 runner 停在 awaiting_disclosure，不发请求）
    const provider = task.provider || 'mineru';
    if (!(await isDisclosureAcked(provider))) openDisclosureSettings(provider);

    // 重新处理
    startParseTask(taskId);
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

/**
 * QA P1-KA：所有发起解析任务的入口（START_PDF_TASK、重试、_INTERNAL_PROCESS_TASK、
 * converter 在 SW 里直接发起的 popup/abs 按钮路径）都走这里，保证同时挂上 keepAlive alarm。
 * 否则 SW 被停后没有 alarm 把它叫醒，轮询会卡住直到用户打开扩展页。
 */
export function startParseTask(taskId) {
  processMinerUTaskInBackground(taskId);
  return refreshKeepAlive();
}

// 仅在有进行中的 MinerU 任务时保持 Service Worker 活跃，空闲时清除 alarm
async function refreshKeepAlive() {
  try {
    await syncKeepAlive(chrome.alarms, await taskManager.getStatistics());
  } catch (error) {
    logger.warn('Failed to sync keep-alive alarm:', error);
  }
}

// R4-12：alarm 唤醒（SW 可能刚被杀掉重启）→ 先续上未完成任务（按 jobId 继续轮询，不重新提交），再同步 alarm
async function resumeAndRefresh() {
  try {
    await migrationsReady;
    const resumed = await resumeParseTasks();
    if (resumed.length) logger.info('Resumed parse tasks:', resumed);
  } catch (error) {
    logger.warn('Failed to resume parse tasks:', error);
  }
  await refreshKeepAlive();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    resumeAndRefresh();
  }
});
resumeAndRefresh();
// DNR 可选权限：用户授权后才安装星河 Origin 规则
installPaddleOriginRuleListeners();

export { processMinerUTaskInBackground };
