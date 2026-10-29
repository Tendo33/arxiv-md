// 主转换器

import ar5ivConverter from './ar5iv-converter';
import storage from '@utils/storage';
import logger from '@utils/logger';
import { isNetworkError, NETWORK_OFFLINE_CODE } from '@utils/network-error';
import {
  CONVERSION_TIER,
  CONVERSION_MODE,
  ERROR_MESSAGES,
  API,
} from '@config/constants';
import {
  generateFilename,
  downloadFile,
  downloadFailureKind,
  showNotification,
} from '@utils/helpers';
import { incompleteNotification } from './incomplete-notification';
import { converterNotification } from './converter-notifications';

// 通知语言跟随扩展设置；取不到时交给 converterNotification 的默认规则，不能让通知拖垮转换
function notifyLang() {
  return Promise.resolve()
    .then(() => storage.getLanguage())
    .catch(() => null);
}
import { ParseError } from '@pdf-core/errors';

/**
 * 主转换器 - 智能三层降级架构
 */
// batch8 AB7-01：PDF 下载失败 → 失败类别 + 通知 key。网络类沿用 AB6-06 的 NETWORK_OFFLINE（状态卡显示网络文案）。
// batch9 ①：4 分钟后还没完成 → 不算失败，通知「仍在下载」；如果之后完成，补发「已保存」通知
function isStillRunning(error) {
  return error?.code === 'DOWNLOAD_STILL_RUNNING';
}
function lateSavedNotifier(key, filename, tabId = null) {
  return () => {
    notifyLang().then((lang) => {
      const n = converterNotification(key, { filename }, lang);
      showNotification(n.title, n.message, 'basic');
    }).catch(() => {});
    // batch9 M2：pending 卡片不自动收起，下载补完成时通知发起页把它换掉
    if (tabId != null) {
      try {
        const r = chrome.tabs.sendMessage(tabId, { type: 'PDF_DOWNLOAD_SETTLED', data: { ok: true, filename } });
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* 页面已关闭 */ }
    }
  };
}
// batch9 审查 P3②：超时后下载被中断——按 AB7 失败原因补发通知，并让发起页把 pending 卡片换成对应的失败/已取消卡
function lateFailureNotifier(tabId = null) {
  return (error) => {
    const { notifyKey, fields } = pdfDownloadFailure(error);
    notifyLang().then((lang) => {
      const n = converterNotification(notifyKey, {}, lang);
      showNotification(n.title, n.message, 'basic');
    }).catch(() => {});
    if (tabId != null) {
      try {
        const r = chrome.tabs.sendMessage(tabId, { type: 'PDF_DOWNLOAD_SETTLED', data: { ok: false, success: false, ...fields } });
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* 页面已关闭 */ }
    }
  };
}
async function notifyStillRunning() {
  const n = converterNotification('download_pending', {}, await notifyLang());
  showNotification(n.title, n.message, 'basic');
}

function pdfDownloadFailure(error) {
  const kind = isNetworkError(error) ? 'network' : downloadFailureKind(error);
  const notifyKey = { network: 'download_failed_network', server: 'download_failed_server', notfound: 'download_failed_notfound',
    forbidden: 'download_failed_forbidden', canceled: 'download_canceled',
    file: 'download_failed_file', removed: 'download_removed' }[kind] || 'download_failed';
  return {
    notifyKey,
    fields: { downloadFailure: kind, ...(kind === 'network' ? { errorCode: NETWORK_OFFLINE_CODE } : {}) },
  };
}

class MainConverter {
  async convert(paperInfo, onProgress = null, tabId = null) {
    const { arxivId } = paperInfo;
    logger.info('Starting conversion:', arxivId);

    const mode = await storage.getConversionMode();
    const mineruToken = await storage.getMinerUToken();
    const includeMetadata = await storage.getIncludeMetadata();

    // popup「PDF 解析」按钮（C-2）带 forceMineru：有 Key 就直接走 PDF 解析
    if ((mode === CONVERSION_MODE.ALWAYS_MINERU || paperInfo.forceMineru) && mineruToken) {
      return this._convertWithMinerU(paperInfo, onProgress, tabId);
    }

    return this._convertWithTieredStrategy(
      paperInfo,
      mode,
      mineruToken,
      onProgress,
      tabId,
      includeMetadata,
    );
  }

  async _convertWithTieredStrategy(
    paperInfo,
    mode,
    mineruToken,
    onProgress,
    tabId,
    includeMetadata,
  ) {
    const { arxivId, title } = paperInfo;

    // Tier 1: official arXiv HTML, then ar5iv
    try {
      if (onProgress)
        onProgress({ tier: 'html', stage: 'checking', progress: 0 });
      logger.info('Tier 1: Trying HTML conversion...');

      const result = await ar5ivConverter.convert(arxivId, tabId, {
        includeMetadata,
        paperInfo,
      });
      const filename = generateFilename(
        {
          title: result.title || title,
          authors: paperInfo.authors,
          year: paperInfo.year,
          arxivId: arxivId,
        },
        'md',
      );

      await this._downloadViaContentScript(result.markdown, filename, tabId);
      await storage.incrementConversion(CONVERSION_TIER.AR5IV_LOCAL);

      const sourceLabel = result.metadata?.sourceLabel
        || (result.metadata?.source === 'arxiv-html' ? 'arXiv HTML' : 'ar5iv');
      if (onProgress)
        onProgress({
          tier: result.metadata?.source || 'html',
          stage: 'completed',
          progress: 100,
        });
      // AF3-01：导出明显少于页面时仍然保存，但通知、徽标和页内提示都改为「可能不完整」
      const incomplete = !!(result.integrity && result.integrity.complete === false);
      // 通知语言跟随扩展设置（与 popup、页面条一致）
      const lang = await notifyLang();
      if (incomplete) {
        const n = incompleteNotification({
          expected: result.integrity.source.headings,
          actual: result.integrity.exported.headings,
          filename,
        }, lang);
        showNotification(n.title, n.message, 'basic');
      } else {
        const n = converterNotification('done', { filename, source: sourceLabel }, lang);
        showNotification(n.title, n.message, 'basic');
      }
      logger.info('Tier 1 success:', filename);

      return {
        success: true,
        tier: CONVERSION_TIER.AR5IV_LOCAL,
        filename,
        markdown: result.markdown,
        ...(incomplete ? {
          incomplete: true,
          integrity: {
            expectedSections: result.integrity.source.headings,
            exportedSections: result.integrity.exported.headings,
          },
        } : {}),
      };
    } catch (ar5ivError) {
      logger.warn('Tier 1 failed:', ar5ivError.message);

      // 断网时不再退回 PDF 下载（下载同样会失败，却会被当成"已保存"），直接给出明确提示
      if (isNetworkError(ar5ivError)) {
        return {
          success: false,
          tier: CONVERSION_TIER.AR5IV_LOCAL,
          errorCode: 'NETWORK_OFFLINE',
          error: ERROR_MESSAGES.NETWORK_OFFLINE,
        };
      }

      // Tier 2: PDF Fallback
      return this._fallbackToPdf(paperInfo, onProgress, tabId);
    }
  }



  async _convertWithMinerU(paperInfo, onProgress, tabId) {
    const { arxivId, title } = paperInfo;
    logger.info('MinerU conversion requested, submitting background task...');

    const mineruToken = await storage.getMinerUToken();
    if (!mineruToken) {
      throw new ParseError('AUTH_INVALID', { provider: 'mineru' });
    }

    // 检测运行环境：background 还是 content script
    const isBackgroundContext = typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.getManifest;

    if (isBackgroundContext) {
      // 在 background 上下文中，直接导入并调用 taskManager 和处理函数
      try {
        const taskManager = (await import('@core/task-manager')).default;

        // 检查是否存在重复任务
        const existingTask = await taskManager.findTaskByArxivId(arxivId);
        if (existingTask) {
          // 返回重复任务信息，让调用方决定如何处理
          return {
            success: false,
            duplicate: true,
            existingTask: {
              id: existingTask.id,
              status: existingTask.status,
              arxivId: existingTask.paperInfo.arxivId,
              title: existingTask.paperInfo.title,
            }
          };
        }

        const task = await taskManager.addTask(paperInfo, 'mineru');

        // 直接导入 background 模块并调用处理函数
        // 注意：不能用 chrome.runtime.sendMessage 给自己发消息，Service Worker 不会收到
        const backgroundModule = await import('@background/index.js');

        // 使用 setTimeout 确保当前调用栈完成后再处理，避免阻塞响应
        setTimeout(() => {
          if (backgroundModule.processMinerUTaskInBackground) {
            backgroundModule.processMinerUTaskInBackground(task.id);
          } else {
            logger.error('processMinerUTaskInBackground not exported from background module');
          }
        }, 0);

        const n = converterNotification('task_submitted', { title }, await notifyLang());
        showNotification(n.title, n.message, 'basic');

        logger.info('MinerU task submitted:', task.id);

        return {
          success: true,
          tier: CONVERSION_TIER.MINERU_API,
          taskId: task.id,
          background: true,
        };
      } catch (error) {
        logger.error('Failed to submit MinerU task:', error);
        throw error;
      }
    } else {
      // 在 content script 上下文中，发送消息到 background
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'START_MINERU_TASK',
            data: paperInfo,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (response && response.success) {
              notifyLang().then((lang) => {
                const n = converterNotification('task_submitted', { title }, lang);
                showNotification(n.title, n.message, 'basic');
              });
              logger.info('MinerU task submitted:', response.taskId);

              resolve({
                success: true,
                tier: CONVERSION_TIER.MINERU_API,
                taskId: response.taskId,
                background: true,
              });
            } else if (response && response.duplicate) {
              // 返回重复任务信息，让调用方决定如何处理
              resolve({
                success: false,
                duplicate: true,
                existingTask: response.existingTask,
              });
            } else {
              reject(new Error(response?.error || '提交任务失败'));
            }
          }
        );
      });
    }
  }



  async _fallbackToPdf(paperInfo, onProgress, tabId = null) {
    const { arxivId, title } = paperInfo;
    logger.info('Tier 2: Falling back to PDF download...');

    if (onProgress)
      onProgress({ tier: 'pdf', stage: 'downloading', progress: 0 });

    try {
      const filename = generateFilename(
        {
          title: title,
          authors: paperInfo.authors,
          year: paperInfo.year,
          arxivId: arxivId,
        },
        'pdf',
      );

      const pdfUrl = paperInfo.pdfUrl || `${API.ARXIV_PDF}/${arxivId}.pdf`;
      try {
        await downloadFile(pdfUrl, filename, { onLateComplete: lateSavedNotifier('pdf_fallback', filename, tabId), onLateFailure: lateFailureNotifier(tabId) });
      } catch (error) {
        if (!isStillRunning(error)) throw error;
        logger.warn('PDF download still running after timeout:', filename);
        await notifyStillRunning();
        return { success: true, pending: true, tier: CONVERSION_TIER.PDF_FALLBACK, filename };
      }
      await storage.incrementConversion(CONVERSION_TIER.PDF_FALLBACK);

      if (onProgress)
        onProgress({ tier: 'pdf', stage: 'completed', progress: 100 });
      const n = converterNotification('pdf_fallback', { filename }, await notifyLang());
      showNotification(n.title, n.message, 'basic');
      logger.info('Tier 2 success:', filename);

      return { success: true, tier: CONVERSION_TIER.PDF_FALLBACK, filename };
    } catch (error) {
      logger.error('PDF download failed:', error);
      // 原始错误只进日志（上一行）。batch8 AB7-01：按下载失败原因选通知，状态卡用同一类别（downloadFailure）
      const { notifyKey, fields } = pdfDownloadFailure(error);
      const n = converterNotification(notifyKey, {}, await notifyLang());
      showNotification(n.title, n.message, 'basic');
      return {
        success: false,
        tier: CONVERSION_TIER.PDF_FALLBACK,
        error: error.message,
        ...fields,
      };
    }
  }

  async downloadPdf(paperInfo, tabId = null) {
    const { arxivId } = paperInfo;
    logger.info('Direct PDF download requested:', arxivId);
    logger.debug('Full paperInfo:', paperInfo);

    try {
      // 使用与 Markdown 相同的文件名格式: (Year) Title - FirstAuthor.pdf
      const filename = generateFilename(
        {
          title: paperInfo.title,
          authors: paperInfo.authors,
          year: paperInfo.year,
          arxivId: arxivId,
        },
        'pdf',
      );

      logger.debug('Generated filename:', filename);

      const pdfUrl = paperInfo.pdfUrl || `${API.ARXIV_PDF}/${arxivId}.pdf`;
      try {
        await downloadFile(pdfUrl, filename, { onLateComplete: lateSavedNotifier('pdf_saved', filename, tabId), onLateFailure: lateFailureNotifier(tabId) });
      } catch (error) {
        if (!isStillRunning(error)) throw error;
        logger.warn('PDF download still running after timeout:', filename);
        await notifyStillRunning();
        return { success: true, pending: true, filename };
      }

      const n = converterNotification('pdf_saved', { filename }, await notifyLang());
      showNotification(n.title, n.message, 'basic');
      logger.info('PDF download success:', filename);

      return { success: true, filename };
    } catch (error) {
      logger.error('PDF download failed:', error);
      // 原始错误只进日志（上一行），通知按原因区分：网络（AB6-06）/ 服务端 / 取消 / 文件 / 其他（batch8 AB7-01）；超时不算失败（batch9）
      const { notifyKey, fields } = pdfDownloadFailure(error);
      const n = converterNotification(notifyKey, {}, await notifyLang());
      showNotification(n.title, n.message, 'basic');
      return {
        success: false,
        error: error.message,
        ...fields,
      };
    }
  }

  /**
   * 通过 Content Script 下载文本文件
   * @private
   */
  async _downloadViaContentScript(content, filename, tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: 'DOWNLOAD_FILE',
          data: { content, filename, mimeType: 'text/markdown;charset=utf-8' },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || '下载失败'));
          }
        },
      );
    });
  }

}

// 导出单例
export default new MainConverter();
