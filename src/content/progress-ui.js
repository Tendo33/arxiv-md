import { translations } from '@config/locales';

let t = translations.en;

export function setProgressText(next) {
  t = next || translations.en;
}

export function updateProgressUI(progress) {
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (!progressIndicator) return;

  const stageText = {
    checking: t.content_progress_checking,
    downloading: t.content_progress_downloading,
    submitting: t.content_progress_submitting,
    processing: t.content_progress_processing,
    extracting: t.content_progress_extracting,
    completed: t.content_progress_completed,
  };

  setProgressState({
    text: stageText[progress.stage] || t.content_progress_processing,
    percent: Math.round(progress.progress || 0),
    state: 'processing',
  });
}

// Toast 通知已被移除，通知由 background script 的系统通知处理

export function setProgressState({ text, percent = null, detail = '', state = '' }) {
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (!progressIndicator) return;

  const textEl = progressIndicator.querySelector('.progress-text');
  const percentEl = progressIndicator.querySelector('.progress-percent');
  const detailEl = progressIndicator.querySelector('.progress-detail');

  progressIndicator.style.display = 'flex';
  removeResultActions(progressIndicator);
  progressIndicator.classList.remove('error', 'success');
  if (state === 'error' || state === 'success') {
    progressIndicator.classList.add(state);
  }

  if (textEl) textEl.textContent = text || t.content_progress_processing;
  if (percentEl) {
    percentEl.textContent =
      percent === null || Number.isNaN(percent) ? '' : `${percent}%`;
  }
  if (detailEl) {
    detailEl.textContent = detail || '';
    detailEl.style.display = detail ? 'block' : 'none';
  }
}

export function clearProgressState() {
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (!progressIndicator) return;
  removeResultActions(progressIndicator);
  progressIndicator.style.display = 'none';
  progressIndicator.classList.remove('error', 'success');
  // 隐藏时同时清空文字，避免残留上一次的“Completed 100%”
  const textEl = progressIndicator.querySelector('.progress-text');
  const percentEl = progressIndicator.querySelector('.progress-percent');
  const detailEl = progressIndicator.querySelector('.progress-detail');
  if (textEl) textEl.textContent = '';
  if (percentEl) percentEl.textContent = '';
  if (detailEl) {
    detailEl.textContent = '';
    detailEl.style.display = 'none';
  }
}

export function showError(message) {
  setProgressState({
    text: t.content_progress_failed,
    detail: message || t.content_error_generic,
    percent: null,
    state: 'error',
  });
}

export function showSuccess(message) {
  setProgressState({
    text: t.content_progress_completed,
    detail: message || '',
    percent: 100,
    state: 'success',
  });

  setTimeout(() => {
    clearProgressState();
  }, 1600);
}

function removeResultActions(progressIndicator) {
  const actions = progressIndicator.querySelector('.arxiv-md-result-actions');
  if (actions) actions.remove();
}

/**
 * 写入剪贴板。必须在用户点击的回调里调用：
 * 页面内 Clipboard API 不需要 clipboardWrite 权限；失败时退回 execCommand。
 */
export async function copyTextToClipboard(text, doc = document) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // 页面未聚焦或被策略拒绝时走下方的回退
  }
  try {
    const textarea = doc.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    doc.body.appendChild(textarea);
    textarea.select();
    const ok = doc.execCommand('copy');
    textarea.remove();
    return ok;
  } catch (error) {
    return false;
  }
}

/**
 * 转换完成后的结果态：保留在页面上直到用户关闭或开始下一次转换，
 * 显示文件名，有 Markdown 时提供“复制 Markdown”按钮。
 */
export function showResult({ filename = '', markdown = '' } = {}) {
  setProgressState({
    text: t.content_progress_completed,
    detail: filename ? t.content_result_saved.replace('{filename}', filename) : '',
    percent: null,
    state: 'success',
  });

  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (!progressIndicator) return;

  const actions = document.createElement('div');
  actions.className = 'arxiv-md-result-actions';

  const status = document.createElement('span');
  status.className = 'arxiv-md-result-status';
  status.setAttribute('role', 'status');

  if (markdown) {
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'arxiv-md-result-btn primary arxiv-md-copy-btn';
    copyButton.textContent = t.content_btn_copy_md;
    copyButton.addEventListener('click', async () => {
      const ok = await copyTextToClipboard(markdown);
      status.textContent = ok ? t.content_copy_done : t.content_copy_failed;
    });
    actions.appendChild(copyButton);
  }

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'arxiv-md-result-btn arxiv-md-result-close';
  closeButton.textContent = t.content_btn_close;
  closeButton.addEventListener('click', () => clearProgressState());
  actions.appendChild(closeButton);
  actions.appendChild(status);

  progressIndicator.appendChild(actions);
}
