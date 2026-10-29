// Content Script

import metadataExtractor from '@core/metadata-extractor';
import { paperTabTitle } from './bibtex';
import logger from '@utils/logger';
import { isCanceledDownload, statusCardErrorText } from './status-error';
import { REGEX } from '@config/constants';
import storage, { browserDefaultLanguage } from '@utils/storage';
import { translations } from '@config/locales';
import { handleFileDownload, handleBlobDownload } from './page-download';
import { handleHtmlToMarkdown } from './markdown-convert';
import { mountPdfFab } from './pdf-fab';
import { clearHint, injectConvertButton, pdfButtonContent, setConversionHandler, setPageButtonText } from './page-buttons';
import { svg, setChildren } from '@utils/dom';
import { ICON_SPINNER } from './page-icons';
import {
  clearProgressState,
  notifyOutcome,
  onNextOutcome,
  reportShortcutClear,
  reportShortcutFailure,
  setProgressState,
  setProgressText,
  showCanceled,
  showError,
  showResult,
  isPendingShown,
  settlePending,
  showSuccess,
  showSubmitted,
  showPending,
  updateProgressUI,
} from './progress-ui';

logger.info('Content script loaded on:', window.location.href);

setConversionHandler(handleConversionTrigger);

let currentLang = 'en';
let t = translations.en;

// 检查是否在 arXiv 页面
const isArxivAbsPage = REGEX.ARXIV_ABS_PAGE.test(window.location.href);
const isArxivPdfPage = REGEX.ARXIV_PDF_PAGE.test(window.location.href);
// 官方 HTML 版（/html/<id>）：不注入按钮，只响应快捷键，元数据和 PDF 页一样从 abs 页取
const isArxivHtmlPage = REGEX.ARXIV_HTML_PAGE.test(window.location.href);

if (!isArxivAbsPage && !isArxivPdfPage && !isArxivHtmlPage) {
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

  // A3-1：PDF 页悬浮按钮（默认显示，设置里可关）
  if (isArxivPdfPage) await setupPdfFab();

  // 监听来自 Background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug('Content script received message:', message);

    switch (message.type) {
    case 'TRIGGER_CONVERSION':
      // popup（C-2）带 mode：markdown | mineru | pdf，并要求回传结果；快捷键不带参数
      if (message.reply) {
        onNextOutcome(sendResponse);
        handleConversionTrigger(message.mode || 'markdown');
        return true;
      }
      handleConversionTrigger(message.mode || 'markdown');
      break;

    case 'PDF_DOWNLOAD_SETTLED':
    // batch9 M2：pending 的 PDF 下载后来完成了
    {
      // batch9 P3①：按 downloadId 匹配卡片；P3③：回复 handled，后台据此决定取消时还要不要弹系统通知
      const id = message.data?.downloadId ?? null;
      let handled = false;
      if (message.data?.ok) handled = settlePending(t.content_progress_completed, id);
      // batch9 审查 P3②：超时后又中断——仍是 pending 卡片时换成对应的失败 / 已取消卡
      else if (message.data && isPendingShown(id)) {
        (isCanceledDownload(message.data) ? showCanceled : showError)(statusCardErrorText(message.data, t, 'PDF download failed', { download: true }));
        handled = true;
      }
      sendResponse({ received: true, handled });
      return false;
    }

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
    currentLang = lang;
  } catch (error) {
    logger.warn('Failed to load language setting:', error);
    currentLang = browserDefaultLanguage(); // AB8-04
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

    const activeButton = type === 'pdf' ? pdfButton : mdButton;

    if (activeButton) {
      activeButton.disabled = true;
      activeButton.style.opacity = '0.5';
      activeButton.style.cursor = 'not-allowed';
    }

    clearHint(hintIndicator);
    setProgressState({
      text: t.content_progress_processing,
      percent: null, // M-1：开始时还没有真实进度
      state: 'processing',
    });

    // PDF 下载：直接在 content script 中处理（参考脚本方式）
    if (type === 'pdf') {
      await handlePdfDownloadDirect(activeButton);
      return;
    }

    // 断网时直接提示，不再发起注定失败的请求
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (activeButton) {
        activeButton.disabled = false;
        activeButton.style.opacity = '1';
        activeButton.style.cursor = 'pointer';
      }
      showError(t.content_error_offline);
      return;
    }

    // Markdown 转换：通过 background script 处理
    const metadata = isArxivAbsPage
      ? metadataExtractor.extractFromAbsPage()
      : await fetchMetadataFromAbsPage();
    if (type === 'mineru') metadata.forceMineru = true;

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
                notifyOutcome({ ok: !!(forceResponse && forceResponse.success), background: true });
                if (forceResponse && forceResponse.success) {
                  logger.info('Duplicate task created successfully:', forceResponse.taskId);
                  reportShortcutClear();
                } else {
                  // H-01：强制提交失败不经过 showError，单独上报，徽标「!」
                  reportShortcutFailure();
                }
              }
            );
          } else {
            // 用户取消
            logger.info('User cancelled duplicate task creation');
            notifyOutcome({ ok: false, cancelled: true });
            reportShortcutClear();
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

        // 后台把转换结果包在 data 里：data.success === false 同样是失败
        const failure = response?.success === false
          ? response
          : response?.data?.success === false ? response.data : null;
        if (failure) {
          (isCanceledDownload(failure) ? showCanceled : showError)(statusCardErrorText(failure, t, 'Conversion failed'));
          return;
        }

        // batch9 ①：4 分钟后下载还在继续，不是失败
        if (response?.data?.pending) {
          showPending(t.content_download_pending, response.data.downloadId);
        } else if (response?.data?.background) {
          // rp2b ③：异步后端（PaddleOCR / MinerU）只是提交成功，不是完成
          showSubmitted(response.data.provider);
        } else if (response?.data?.filename) {
          showResult({
            filename: response.data.filename,
            markdown: response.data.markdown || '',
            integrity: response.data.incomplete ? response.data.integrity : null,
            emptyContent: !!response.data.emptyContent,
          });
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
      type === 'pdf'
        ? document.querySelector('.arxiv-pdf-download-btn')
        : document.querySelector('.arxiv-md-convert-btn');
    if (activeButton) {
      activeButton.disabled = false;
      activeButton.style.opacity = '1';
      activeButton.style.cursor = 'pointer';
    }

    const progressIndicator = document.querySelector('.arxiv-md-progress');
    showError(statusCardErrorText(error, t, 'Conversion trigger failed'));
  }
}

async function handlePdfDownloadDirect(button) {
  const restoreButton = () => {
    if (button) {
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      setChildren(button, ...pdfButtonContent(t)); // AR-04
    }
  };

  try {
    setProgressState({
      text: t.content_progress_downloading,
      percent: null, // AB8-05：真实进度由后台 CONVERSION_PROGRESS 推送，开始时不显示 0%
      state: 'processing',
    });

    if (button) {
      setChildren(button, svg(document, ICON_SPINNER), t.content_progress_downloading); // AR-04
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
          (isCanceledDownload(response) ? showCanceled : showError)(statusCardErrorText(response, t, 'PDF download failed', { download: true }));
          return;
        }

        if (response?.data?.pending || response?.pending) {
          showPending(t.content_download_pending, (response.data || response).downloadId);
          return;
        }
        showSuccess(t.content_progress_completed);
        logger.info('PDF download initiated via background');
      }
    );
  } catch (error) {
    logger.error('PDF download failed:', error);
    restoreButton();
    (isCanceledDownload(error) ? showCanceled : showError)(statusCardErrorText(error, t, 'PDF download failed', { download: true }));
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


let pdfFab = null;
async function setupPdfFab() {
  const show = await storage.getShowPdfFab().catch(() => true);
  if (show) mountFab();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.showPdfFab) return;
    if (changes.showPdfFab.newValue === false) { if (pdfFab) { pdfFab.remove(); pdfFab = null; } }
    else if (!pdfFab) mountFab();
  });
}

function mountFab() {
  pdfFab = mountPdfFab(document, {
    labels: {
      idle: t.content_fab_idle, run: t.content_fab_run, ok: t.content_fab_ok, err: t.content_fab_err,
    },
    onClick: () => {
      const fab = pdfFab;
      fab.setState('run');
      onNextOutcome((res) => fab.setState(res && res.ok ? 'ok' : 'err'));
      handleConversionTrigger('markdown');
    },
  });
}
