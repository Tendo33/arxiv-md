import metadataExtractor from '@core/metadata-extractor';
import logger from '@utils/logger';
import { buildArxivBibtex, chooseBibtex } from './bibtex';
import { PAGE_BUTTON_STYLES } from './page-button-styles';
import storage from '@utils/storage';
import { REGEX } from '@config/constants';
import { translations } from '@config/locales';

let t = translations.en;
let startConversion = () => {};
let hintEpoch = 0;
const isArxivAbsPage = REGEX.ARXIV_ABS_PAGE.test(window.location.href);

export function setPageButtonText(next) {
  t = next || translations.en;
}

export function setConversionHandler(handler) {
  startConversion = handler;
}

export async function injectConvertButton() {
  if (!isArxivAbsPage) return; // 只在 Abstract 页面注入

  // 查找 Submission history 板块
  const submissionHistory = document.querySelector('.submission-history');
  if (!submissionHistory) {
    logger.warn('Submission history section not found, cannot inject buttons');
    return;
  }

  // 读取用户设置的转换模式
  let conversionMode = 'fast'; // 默认模式
  try {
    const result = await chrome.storage.sync.get('conversionMode');
    conversionMode = result.conversionMode || 'fast';
  } catch (error) {
    logger.warn('Failed to get conversion mode, using default:', error);
  }

  // 根据模式设置显示标签
  const modeLabel =
    conversionMode === 'always'
      ? t.content_mode_mineru
      : t.content_mode_ar5iv;

  // 注入样式
  const style = document.createElement('style');
  style.textContent = PAGE_BUTTON_STYLES;
  document.head.appendChild(style);

  // 创建按钮容器
  const container = document.createElement('div');
  container.className = 'arxiv-md-btn-container';

  // 创建 Markdown 按钮
  const mdButton = document.createElement('button');
  mdButton.className = 'arxiv-md-convert-btn arxiv-md-btn arxiv-md-btn-primary';
  mdButton.setAttribute('aria-label', t.content_btn_markdown);
  mdButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.5 1.5A1.5 1.5 0 0 0 7 0H3.5A1.5 1.5 0 0 0 2 1.5v13A1.5 1.5 0 0 0 3.5 16h9a1.5 1.5 0 0 0 1.5-1.5V7L8.5 1.5z"/>
      <path d="M8 1v5.5A1.5 1.5 0 0 0 9.5 8H15"/>
    </svg>
    ${t.content_btn_markdown} <span class="arxiv-md-btn-sub">(${modeLabel})</span>
  `;
  mdButton.addEventListener('click', () => startConversion('markdown'));

  // 创建 PDF 按钮
  const pdfButton = document.createElement('button');
  pdfButton.className = 'arxiv-pdf-download-btn arxiv-md-btn arxiv-md-btn-secondary';
  pdfButton.setAttribute('aria-label', t.content_btn_pdf);
  pdfButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
      <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/>
    </svg>
    ${t.content_btn_pdf} <span class="arxiv-md-btn-sub">(${t.content_btn_sub_title})</span>
  `;
  pdfButton.addEventListener('click', () => startConversion('pdf'));

  const citeButton = document.createElement('button');
  citeButton.type = 'button';
  citeButton.className = 'arxiv-md-btn arxiv-md-btn-quiet';
  citeButton.setAttribute('aria-label', t.content_btn_bibtex);
  citeButton.textContent = t.content_btn_bibtex;

  // 创建进度指示器
  const progressIndicator = document.createElement('div');
  progressIndicator.className = 'arxiv-md-progress';
  progressIndicator.innerHTML = `
    <div class="progress-row">
      <span class="progress-text">${t.content_progress_processing}</span>
      <span class="progress-percent" style="margin-left: 6px; font-weight: 600;">0%</span>
    </div>
    <div class="progress-detail"></div>
  `;

  const hintIndicator = document.createElement('div');
  hintIndicator.className = 'arxiv-md-hint';

  const autoPrompt = document.createElement('div');
  autoPrompt.className = 'arxiv-md-auto';
  autoPrompt.innerHTML = `
    <span class="auto-text">${t.content_auto_prompt_title}</span>
    <span class="auto-desc">${t.content_auto_prompt_desc}</span>
    <div class="arxiv-md-auto-actions">
      <button class="arxiv-md-auto-btn primary" data-action="auto-confirm">${t.content_auto_prompt_confirm}</button>
      <button class="arxiv-md-auto-btn" data-action="auto-cancel">${t.content_auto_prompt_cancel}</button>
    </div>
  `;

  container.appendChild(mdButton);
  container.appendChild(pdfButton);
  container.appendChild(citeButton);
  container.appendChild(progressIndicator);
  container.appendChild(hintIndicator);
  container.appendChild(autoPrompt);

  // 插入到 Submission history 后面
  submissionHistory.parentNode.insertBefore(
    container,
    submissionHistory.nextSibling,
  );

  citeButton.addEventListener('click', () => copyBibtex(citeButton, hintIndicator));

  logger.info('Convert buttons injected below Submission history');

  // Check ar5iv availability
  checkAr5ivAvailability(mdButton, hintIndicator);

  // Auto convert prompt (optional)
  const autoConvert = await storage.getAutoConvert();
  if (autoConvert) {
    showAutoConvertPrompt(autoPrompt);
  }
}

async function writeClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      logger.debug('Async clipboard rejected:', error);
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('copy failed');
}

async function copyBibtex(button, hintEl) {
  const metadata = metadataExtractor.extractFromAbsPage(document);
  const fallback = buildArxivBibtex(metadata);
  button.disabled = true;
  try {
    let official = '';
    if (metadata.arxivId) {
      const id = metadata.arxivId.replace(/v\d+$/i, '');
      const response = await fetch(`https://arxiv.org/bibtex/${encodeURIComponent(id)}`);
      if (response.ok) official = await response.text();
    }
    await writeClipboard(chooseBibtex(official, fallback));
    setHint(hintEl, t.content_bibtex_copied);
  } catch (error) {
    logger.warn('BibTeX copy failed:', error);
    try {
      await writeClipboard(fallback);
      setHint(hintEl, t.content_bibtex_copied);
    } catch (copyError) {
      logger.error('BibTeX fallback copy failed:', copyError);
      setHint(hintEl, t.content_bibtex_failed);
    }
  } finally {
    button.disabled = false;
  }
}

async function checkAr5ivAvailability(button, hintEl) {
  try {
    // 首先检查用户设置的转换模式
    let conversionMode = 'fast'; // 默认模式
    try {
      const result = await chrome.storage.sync.get('conversionMode');
      conversionMode = result.conversionMode || 'fast';
    } catch (error) {
      logger.warn('Failed to get conversion mode:', error);
    }

    // 如果是 mineru 模式（always），不需要检查 ar5iv 可用性
    // mineru 直接使用 PDF 进行转换，不依赖 ar5iv 页面
    if (conversionMode === 'always') {
      logger.debug('MinerU mode enabled, skipping ar5iv availability check');
      return;
    }

    const arxivId = metadataExtractor._extractIdFromUrl(window.location.href);
    if (!arxivId) return;

    // 只在标准模式（fast）下检查 ar5iv 可用性
    const epoch = hintEpoch;
    chrome.runtime.sendMessage(
      { type: 'CHECK_AR5IV', data: arxivId },
      (response) => {
        if (epoch !== hintEpoch) return;
        if (chrome.runtime.lastError) {
          logger.warn('Failed to check ar5iv:', chrome.runtime.lastError);
          return;
        }

        if (response && response.success && response.available === false) {
          logger.info(`ar5iv not available for ${arxivId}, showing fallback hint`);
          setHint(hintEl, t.content_ar5iv_unavailable);
          button.setAttribute('data-ar5iv-unavailable', 'true');
        } else {
          logger.debug(`ar5iv available for ${arxivId}`);
          clearHint(hintEl);
          button.removeAttribute('data-ar5iv-unavailable');
        }
      },
    );
  } catch (error) {
    logger.error('Error checking ar5iv availability:', error);
  }
}

function setHint(hintEl, message) {
  hintEpoch += 1;
  if (!hintEl) return;
  hintEl.textContent = message;
  hintEl.style.display = message ? 'block' : 'none';
}

export function clearHint(hintEl) {
  if (!hintEl) return;
  hintEl.textContent = '';
  hintEl.style.display = 'none';
}

function showAutoConvertPrompt(autoPromptEl) {
  if (!autoPromptEl) return;
  autoPromptEl.style.display = 'flex';

  if (autoPromptEl.dataset.bound) return;
  autoPromptEl.dataset.bound = 'true';

  autoPromptEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'auto-confirm') {
      autoPromptEl.style.display = 'none';
      startConversion('markdown');
    } else if (action === 'auto-cancel') {
      autoPromptEl.style.display = 'none';
    }
  });
}
