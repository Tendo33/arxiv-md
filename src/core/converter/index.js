// 主转换器

import ar5ivConverter from './ar5iv-converter';
import storage from '@utils/storage';
import logger from '@utils/logger';
import {
  CONVERSION_TIER,
  CONVERSION_MODE,
  ERROR_MESSAGES,
  API,
} from '@config/constants';
import {
  generateFilename,
  downloadBlob,
  downloadFile,
  showNotification,
} from '@utils/helpers';

/**
 * 主转换器 - 智能三层降级架构
 */
class MainConverter {
  async convert(paperInfo, onProgress = null, tabId = null) {
    const { arxivId } = paperInfo;
    logger.info('Starting conversion:', arxivId);

    const mode = await storage.getConversionMode();
    const mineruToken = await storage.getMinerUToken();

    if (mode === CONVERSION_MODE.ALWAYS_MINERU && mineruToken) {
      return this._convertWithMinerU(paperInfo, onProgress, tabId);
    }

    return this._convertWithTieredStrategy(
      paperInfo,
      mode,
      mineruToken,
      onProgress,
      tabId,
    );
  }

  async _convertWithTieredStrategy(
    paperInfo,
    mode,
    mineruToken,
    onProgress,
    tabId,
  ) {
    const { arxivId, title } = paperInfo;

    // Tier 1: ar5iv
    try {
      if (onProgress)
        onProgress({ tier: 'ar5iv', stage: 'checking', progress: 0 });
      logger.info('Tier 1: Trying ar5iv conversion...');

      const result = await ar5ivConverter.convert(arxivId, tabId);
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

      if (onProgress)
        onProgress({ tier: 'ar5iv', stage: 'completed', progress: 100 });
      showNotification(
        '✅ 转换完成',
        `已保存：${filename}\n方式：ar5iv`,
        'basic',
      );
      logger.info('Tier 1 success:', filename);

      return { success: true, tier: CONVERSION_TIER.AR5IV_LOCAL, filename };
    } catch (ar5ivError) {
      logger.warn('Tier 1 failed:', ar5ivError.message);

      // Tier 2: PDF Fallback
      return this._fallbackToPdf(paperInfo, onProgress);
    }
  }



  async _convertWithMinerU(paperInfo, onProgress, tabId) {
    const { arxivId, title } = paperInfo;
    logger.info('MinerU conversion requested, submitting background task...');

    const mineruToken = await storage.getMinerUToken();
    if (!mineruToken) {
      throw new Error(ERROR_MESSAGES.MINERU_TOKEN_MISSING);
    }

    // 检测运行环境：background 还是 content script
    const isBackgroundContext = typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.getManifest;

    if (isBackgroundContext) {
      // 在 background 上下文中，直接导入并调用 taskManager 和处理函数
      try {
        const taskManager = (await import('@core/task-manager')).default;
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

        showNotification(
          '✅ MinerU 任务已提交',
          `${title}\n正在后台处理，完成后将通知您\n可点击插件图标查看进度`,
          'basic'
        );

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
              showNotification(
                '✅ MinerU 任务已提交',
                `${title}\n正在后台处理，完成后将通知您\n可点击插件图标查看进度`,
                'basic'
              );
              logger.info('MinerU task submitted:', response.taskId);

              resolve({
                success: true,
                tier: CONVERSION_TIER.MINERU_API,
                taskId: response.taskId,
                background: true,
              });
            } else {
              reject(new Error(response?.error || '提交任务失败'));
            }
          }
        );
      });
    }
  }



  async _fallbackToPdf(paperInfo, onProgress) {
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
      await downloadFile(pdfUrl, filename);
      await storage.incrementConversion(CONVERSION_TIER.PDF_FALLBACK);

      if (onProgress)
        onProgress({ tier: 'pdf', stage: 'completed', progress: 100 });
      showNotification('ℹ️ 已保存为 PDF', `文件：${filename}`, 'basic');
      logger.info('Tier 2 success:', filename);

      return { success: true, tier: CONVERSION_TIER.PDF_FALLBACK, filename };
    } catch (error) {
      logger.error('PDF download failed:', error);
      showNotification(
        '❌ 转换失败',
        error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
        'basic',
      );
      return {
        success: false,
        tier: CONVERSION_TIER.PDF_FALLBACK,
        error: error.message,
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
      await downloadFile(pdfUrl, filename);

      showNotification('✅ PDF 已保存', `文件：${filename}`, 'basic');
      logger.info('PDF download success:', filename);

      return { success: true, filename };
    } catch (error) {
      logger.error('PDF download failed:', error);
      showNotification(
        '❌ 下载失败',
        error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
        'basic',
      );
      return {
        success: false,
        error: error.message,
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

  /**
   * 通过 Content Script 下载 Blob 文件
   * @private
   */
  async _downloadBlobViaContentScript(blob, filename, tabId) {
    return new Promise((resolve, reject) => {
      // 将 Blob 转换为 base64 以便传输
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        chrome.tabs.sendMessage(
          tabId,
          {
            type: 'DOWNLOAD_BLOB',
            data: { base64, filename, mimeType: blob.type || 'application/zip' },
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
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 下载 Markdown 文件（回退方案）
   * @private
   */
  async _downloadMarkdown(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, filename);
  }
}

// 导出单例
export default new MainConverter();
