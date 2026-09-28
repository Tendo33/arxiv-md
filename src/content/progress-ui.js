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
  progressIndicator.style.display = 'none';
  progressIndicator.classList.remove('error', 'success');
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
