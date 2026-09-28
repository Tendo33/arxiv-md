// Content Script

import metadataExtractor from '@core/metadata-extractor';
import { paperTabTitle } from './bibtex';
import logger from '@utils/logger';
import { REGEX } from '@config/constants';
import storage from '@utils/storage';
import { translations } from '@config/locales';
import { handleFileDownload, handleBlobDownload } from './page-download';
import { handleHtmlToMarkdown } from './markdown-convert';
import { clearHint, injectConvertButton, setConversionHandler, setPageButtonText } from './page-buttons';
import {
  clearProgressState,
  setProgressState,
  setProgressText,
  showError,
  showSuccess,
  updateProgressUI,
} from './progress-ui';

logger.info('Content script loaded on:', window.location.href);

setConversionHandler(handleConversionTrigger);

let currentLang = 'en';
let t = translations.en;

// 检查是否在 arXiv 页面
const isArxivAbsPage = REGEX.ARXIV_ABS_PAGE.test(window.location.href);
const isArxivPdfPage = REGEX.ARXIV_PDF_PAGE.test(window.location.href);

if (!isArxivAbsPage && !isArxivPdfPage) {
  logger.warn('Not an arXiv page, exiting');
} else {
  init().catch((error) => logger.error('Init failed:', error));
}

async function init() {
  logger.debug('Initializing content script');

  await initLanguage();

  if (isArxivAbsPage) {
    const title = paperTabTitle(metadataExtractor.extractFromAbsPage(document).title);
    if (title) document.title = title;
  }

  // 注入转换按钮
  await injectConvertButton();

  // 监听来自 Background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug('Content script received message:', message);

    switch (message.type) {
    case 'TRIGGER_CONVERSION':
      handleConversionTrigger();
      break;

    case 'CONVERSION_PROGRESS':
      updateProgressUI(message.data);
      break;

    case 'CONVERT_HTML_TO_MARKDOWN':
      // 在真实浏览器环境中执行 HTML → Markdown 转换
      handleHtmlToMarkdown(message.data, sendResponse);
      return true; // 保持消息通道打开以异步响应

    case 'DOWNLOAD_FILE':
      // 在页面环境中执行文本文件下载（使用 <a> download 属性）
      handleFileDownload(message.data, sendResponse);
      return true; // 保持消息通道打开以异步响应

    case 'DOWNLOAD_BLOB':
      // 在页面环境中执行 Blob 文件下载（从 base64）
      handleBlobDownload(message.data, sendResponse);
      return true; // 保持消息通道打开以异步响应
    }

    sendResponse({ received: true });
  });
}

async function initLanguage() {
  try {
    const lang = await storage.getLanguage();
    currentLang = lang || 'en';
  } catch (error) {
    logger.warn('Failed to load language setting:', error);
    currentLang = 'en';
  }
  t = translations[currentLang] || translations.en;
  setPageButtonText(t);
  setProgressText(t);
}

async function handleConversionTrigger(type = 'markdown') {
  logger.info(`${type} conversion triggered`);

  try {
    const mdButton = document.querySelector('.arxiv-md-convert-btn');
    const pdfButton = document.querySelector('.arxiv-pdf-download-btn');
    const hintIndicator = document.querySelector('.arxiv-md-hint');

    const activeButton = type === 'markdown' ? mdButton : pdfButton;

    if (activeButton) {
      activeButton.disabled = true;
      activeButton.style.opacity = '0.5';
      activeButton.style.cursor = 'not-allowed';
    }

    clearHint(hintIndicator);
    setProgressState({
      text: t.content_progress_processing,
      percent: 0,
      state: 'processing',
    });

    // PDF 下载：直接在 content script 中处理（参考脚本方式）
    if (type === 'pdf') {
      await handlePdfDownloadDirect(activeButton);
      return;
    }

    // Markdown 转换：通过 background script 处理
    const metadata = isArxivAbsPage
      ? metadataExtractor.extractFromAbsPage()
      : await fetchMetadataFromAbsPage();

    logger.debug('Extracted metadata:', metadata);

    chrome.runtime.sendMessage(
      { type: 'CONVERT_PAPER', data: metadata },
      async (response) => {
        // Check for extension context invalidation (happens when extension reloads)
        if (chrome.runtime.lastError) {
          logger.error(
            'Failed to send message to background:',
            chrome.runtime.lastError.message,
          );
          // Restore button state
          if (activeButton) {
            activeButton.disabled = false;
            activeButton.style.opacity = '1';
            activeButton.style.cursor = 'pointer';
          }
          showError(t.content_error_extension_reloaded);
          return;
        }

        logger.debug('Markdown conversion response:', response);

        // 处理重复任务的情况
        if (response && response.duplicate) {
          const existingTask = response.existingTask;
          const statusText = {
            pending: t.popup_status_pending || 'Pending',
            processing: t.popup_status_processing || 'Processing',
            completed: t.popup_status_completed || 'Completed',
            failed: t.popup_status_failed || 'Failed',
          }[existingTask.status] || existingTask.status;

          const confirmMessage = t.content_confirm_duplicate.replace(
            '{status}',
            statusText,
          );

          if (confirm(confirmMessage)) {
            // 用户确认，强制创建新任务
            logger.info('User confirmed to create duplicate task');
            chrome.runtime.sendMessage(
              { type: 'START_MINERU_TASK_FORCE', data: metadata },
              (forceResponse) => {
                if (activeButton) {
                  activeButton.disabled = false;
                  activeButton.style.opacity = '1';
                  activeButton.style.cursor = 'pointer';
                }
                clearProgressState();
                if (forceResponse && forceResponse.success) {
                  logger.info('Duplicate task created successfully:', forceResponse.taskId);
                }
              }
            );
          } else {
            // 用户取消
            logger.info('User cancelled duplicate task creation');
            if (activeButton) {
              activeButton.disabled = false;
              activeButton.style.opacity = '1';
              activeButton.style.cursor = 'pointer';
            }
            clearProgressState();
          }
          return;
        }

        if (activeButton) {
          activeButton.disabled = false;
          activeButton.style.opacity = '1';
          activeButton.style.cursor = 'pointer';
        }

        if (response && response.success === false) {
          showError(response.error || t.content_error_generic);
          return;
        }

        if (response?.data?.background) {
          showSuccess(t.content_progress_submitted);
        } else {
          showSuccess(t.content_progress_completed);
        }

        // 通知已由 background script 处理，不需要在这里显示 Toast
      },
    );
  } catch (error) {
    logger.error('Conversion trigger failed:', error);

    // 恢复按钮状态
    const activeButton =
      type === 'markdown'
        ? document.querySelector('.arxiv-md-convert-btn')
        : document.querySelector('.arxiv-pdf-download-btn');
    if (activeButton) {
      activeButton.disabled = false;
      activeButton.style.opacity = '1';
      activeButton.style.cursor = 'pointer';
    }

    const progressIndicator = document.querySelector('.arxiv-md-progress');
    showError(error.message || t.content_error_generic);
  }
}

async function handlePdfDownloadDirect(button) {
  const pdfIconSvg = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
      <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/>
    </svg>
  `;

  const restoreButton = () => {
    if (button) {
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.innerHTML = `${pdfIconSvg}${t.content_btn_pdf} <span class="arxiv-md-btn-sub">(${t.content_btn_sub_title})</span>`;
    }
  };

  try {
    setProgressState({
      text: t.content_progress_downloading,
      percent: 0,
      state: 'processing',
    });

    if (button) {
      button.innerHTML = `
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-opacity="0.3"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        ${t.content_progress_downloading}
      `;
    }

    const metadata = isArxivAbsPage
      ? metadataExtractor.extractFromAbsPage()
      : await fetchMetadataFromAbsPage();

    chrome.runtime.sendMessage(
      { type: 'DOWNLOAD_PDF', data: metadata },
      (response) => {
        restoreButton();

        if (chrome.runtime.lastError) {
          logger.error('PDF download message failed:', chrome.runtime.lastError.message);
          showError(t.content_error_extension_reloaded);
          return;
        }

        if (response && (response.success === false || response.data?.success === false)) {
          showError(response.error || response.data?.error || t.content_error_generic);
          return;
        }

        showSuccess(t.content_progress_completed);
        logger.info('PDF download initiated via background');
      }
    );
  } catch (error) {
    logger.error('PDF download failed:', error);
    restoreButton();
    showError(error.message || t.content_error_generic);
  }
}

async function fetchMetadataFromAbsPage() {
  const arxivId = metadataExtractor._extractIdFromUrl(window.location.href);

  if (!arxivId) {
    throw new Error('Cannot extract arXiv ID');
  }

  // 使用 API 获取
  return await metadataExtractor.fetchMetadataFromApi(arxivId);
}

