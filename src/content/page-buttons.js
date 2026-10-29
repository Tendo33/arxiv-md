import { h, svg, setChildren } from '@utils/dom';
import { ICON_MARKDOWN, ICON_PDF } from './page-icons';
import metadataExtractor from '@core/metadata-extractor';
import logger from '@utils/logger';
import { buildArxivBibtex, chooseBibtex } from './bibtex';
import { PAGE_BUTTON_STYLES } from './page-button-styles';
import { detectPageTheme } from './page-theme';
import storage from '@utils/storage';
import { REGEX } from '@config/constants';
import { translations } from '@config/locales';
import { providerLabel } from '@config/pdf-providers';
import { setProgressProvider } from './progress-ui';

let t = translations.en;
let startConversion = () => {};
let hintEpoch = 0;
const isArxivAbsPage = REGEX.ARXIV_ABS_PAGE.test(window.location.href);

/** PDF 按钮内容：图标 +「PDF」+ 副标题「标题」（abs-buttons v2：不加括号，分隔点由 CSS 生成）；恢复按钮时 content/index.js 也用它 */
export function pdfButtonContent(tr) {
  return [svg(document, ICON_PDF), `${tr.content_btn_pdf} `, h(document, 'span', { class: 'arxiv-md-btn-sub' }, tr.content_btn_sub_title)];
}

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
  let pdfProvider; // 未选择时 providerLabel 用默认后端
  try {
    const result = await chrome.storage.sync.get(['conversionMode', 'pdfProvider']);
    conversionMode = result.conversionMode || 'fast';
    pdfProvider = result.pdfProvider;
  } catch (error) {
    logger.warn('Failed to get conversion mode, using default:', error);
  }

  // 根据模式设置显示标签
  const modeLabel =
    conversionMode === 'always'
      ? t.content_mode_mineru.replace('{provider}', providerLabel(pdfProvider))
      : t.content_mode_ar5iv;
  setProgressProvider(pdfProvider);

  // 注入样式
  const style = document.createElement('style');
  style.textContent = PAGE_BUTTON_STYLES;
  document.head.appendChild(style);

  // 创建按钮容器
  const container = document.createElement('div');
  container.className = 'arxiv-md-btn-container';
  container.dataset.theme = detectPageTheme();

  // 创建 Markdown 按钮
  const mdButton = document.createElement('button');
  mdButton.className = 'arxiv-md-convert-btn arxiv-md-btn arxiv-md-btn-primary';
  mdButton.setAttribute('aria-label', t.content_btn_markdown);
  // AR-04：DOM API 构建，文案走文本节点
  setChildren(mdButton, svg(document, ICON_MARKDOWN), `${t.content_btn_markdown} `,
    h(document, 'span', { class: 'arxiv-md-btn-sub' }, modeLabel));
  mdButton.addEventListener('click', () => startConversion('markdown'));

  // 创建 PDF 按钮
  const pdfButton = document.createElement('button');
  pdfButton.className = 'arxiv-pdf-download-btn arxiv-md-btn arxiv-md-btn-secondary';
  // release-polish 设计：可见文字只有「PDF（标题）」，完整含义放在 title 和 aria-label 里
  pdfButton.setAttribute('aria-label', t.content_btn_pdf_label);
  pdfButton.title = t.content_btn_pdf_label;
  setChildren(pdfButton, ...pdfButtonContent(t));
  pdfButton.addEventListener('click', () => startConversion('pdf'));

  const citeButton = document.createElement('button');
  citeButton.type = 'button';
  citeButton.className = 'arxiv-md-btn arxiv-md-btn-quiet';
  citeButton.setAttribute('aria-label', t.content_btn_bibtex);
  citeButton.textContent = t.content_btn_bibtex;

  // 创建进度指示器
  const progressIndicator = document.createElement('div');
  progressIndicator.className = 'arxiv-md-progress';
  progressIndicator.setAttribute('role', 'status');
  progressIndicator.setAttribute('aria-live', 'polite');
  progressIndicator.setAttribute('aria-atomic', 'true');
  setChildren(progressIndicator,
    h(document, 'div', { class: 'progress-row' }, [
      h(document, 'span', { class: 'progress-text' }, t.content_progress_processing),
      // M-1：百分比不进读屏（live 区只播阶段文字），开始时不写死 0%
      h(document, 'span', { class: 'progress-percent', 'aria-hidden': 'true' }, ''),
    ]),
    h(document, 'div', {
      class: 'progress-bar indeterminate', role: 'progressbar',
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': t.content_progress_bar_label,
    }, h(document, 'i', { class: 'progress-fill' })),
    h(document, 'div', { class: 'progress-detail' }));

  const hintIndicator = document.createElement('div');
  hintIndicator.className = 'arxiv-md-hint';
  hintIndicator.setAttribute('role', 'status');

  const autoPrompt = document.createElement('div');
  autoPrompt.className = 'arxiv-md-auto';
  setChildren(autoPrompt,
    h(document, 'span', { class: 'auto-text' }, t.content_auto_prompt_title),
    h(document, 'span', { class: 'auto-desc' }, t.content_auto_prompt_desc),
    h(document, 'div', { class: 'arxiv-md-auto-actions' }, [
      h(document, 'button', { class: 'arxiv-md-auto-btn primary', 'data-action': 'auto-confirm' }, t.content_auto_prompt_confirm),
      h(document, 'button', { class: 'arxiv-md-auto-btn', 'data-action': 'auto-cancel' }, t.content_auto_prompt_cancel),
    ]));

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

  // 官方 HTML 和 ar5iv 都没有时，才提示 PDF 兜底
  checkHtmlAvailability(mdButton, hintIndicator);

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

async function checkHtmlAvailability(button, hintEl) {
  try {
    // 首先检查用户设置的转换模式
    let conversionMode = 'fast'; // 默认模式
    try {
      const result = await chrome.storage.sync.get('conversionMode');
      conversionMode = result.conversionMode || 'fast';
    } catch (error) {
      logger.warn('Failed to get conversion mode:', error);
    }

    // MinerU 直接提交 PDF，不依赖 HTML 论文
    if (conversionMode === 'always') {
      logger.debug('MinerU mode enabled, skipping HTML availability check');
      return;
    }

    const arxivId = metadataExtractor._extractIdFromUrl(window.location.href);
    if (!arxivId) return;

    const epoch = hintEpoch;
    chrome.runtime.sendMessage(
      { type: 'CHECK_AR5IV', data: arxivId },
      (response) => {
        if (epoch !== hintEpoch) return;
        if (chrome.runtime.lastError) {
          logger.warn('Failed to check HTML:', chrome.runtime.lastError);
          return;
        }

        if (response && response.success && response.available === false) {
          logger.info(`HTML not available for ${arxivId}, showing fallback hint`);
          setHint(hintEl, t.content_ar5iv_unavailable);
          button.setAttribute('data-html-unavailable', 'true');
        } else {
          logger.debug(`HTML available for ${arxivId}`);
          clearHint(hintEl);
          button.removeAttribute('data-html-unavailable');
        }
      },
    );
  } catch (error) {
    logger.error('Error checking HTML availability:', error);
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
