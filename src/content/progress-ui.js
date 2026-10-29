import { translations } from '@config/locales';
import { providerLabel } from '@config/pdf-providers';

let t = translations.en;
let provider = providerLabel();

export function setProgressProvider(id) {
  provider = providerLabel(id);
}

export function withProvider(text) {
  return String(text || '').replace(/\{provider\}/g, provider);
}

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
    processing: t.content_progress_parsing,
    extracting: t.content_progress_extracting,
    completed: t.content_progress_completed,
  };

  setProgressState({
    text: withProvider(stageText[progress.stage] || t.content_progress_processing),
    // M-1（rp2）：只有下载阶段且已知总大小（bytesKnown，来自 bytesReceived/totalBytes）才算确定进度；
    // 检查/提交/解析/提取等阶段的百分比只是估算，一律走不确定态：不写 aria-valuenow、不显示百分比
    percent: isDeterminate(progress) ? Math.round(progress.progress) : null,
    state: 'processing',
  });
}

export function isDeterminate(progress) {
  return !!progress && progress.stage === 'downloading' && progress.bytesKnown === true
    && typeof progress.progress === 'number' && !Number.isNaN(progress.progress);
}

// Toast 通知已被移除，通知由 background script 的系统通知处理

export function setProgressState({ text, percent = null, detail = '', file = '', state = '', polite = false }) {
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (!progressIndicator) return;

  const textEl = progressIndicator.querySelector('.progress-text');
  const percentEl = progressIndicator.querySelector('.progress-percent');
  const detailEl = progressIndicator.querySelector('.progress-detail');

  progressIndicator.style.display = 'flex';
  delete progressIndicator.dataset.pending;
  delete progressIndicator.dataset.downloadId;
  removeResultActions(progressIndicator);
  progressIndicator.classList.remove('error', 'success', 'warning', 'submitted');
  const icon = progressIndicator.querySelector('.progress-icon');
  if (icon) icon.remove();
  if (state === 'error' || state === 'success' || state === 'warning' || state === 'submitted') {
    progressIndicator.classList.add(state);
  }
  // 读屏：进度/成功用 polite 播报，错误用 alert 立即播报
  // batch9 S3：polite=true（已取消）即使沿用错误样式也走 status/polite，不打断读屏
  const assertive = state === 'error' && !polite;
  progressIndicator.setAttribute('role', assertive ? 'alert' : 'status');
  progressIndicator.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  progressIndicator.setAttribute('aria-atomic', 'true');

  // M-1：只在阶段文字变化时写入，避免每次进度刷新都让读屏重读
  const nextText = text || t.content_progress_processing;
  if (textEl && textEl.textContent !== nextText) textEl.textContent = nextText;
  const known = typeof percent === 'number' && !Number.isNaN(percent);
  if (percentEl) percentEl.textContent = known ? `${percent}%` : '';
  const bar = progressIndicator.querySelector('.progress-bar');
  if (bar) {
    // 进度条只在进行中显示；拿不到总大小时为不确定态，不设 aria-valuenow
    bar.hidden = state !== 'processing' && state !== '';
    bar.classList.toggle('indeterminate', !known);
    if (known) bar.setAttribute('aria-valuenow', String(percent));
    else bar.removeAttribute('aria-valuenow');
    if (bar.firstElementChild) bar.firstElementChild.style.width = known ? `${percent}%` : '';
  }
  if (detailEl) {
    detailEl.textContent = detail || '';
    detailEl.style.display = detail ? 'block' : 'none';
  }
  setFileLine(progressIndicator, detailEl, file);
}

// AF3 设计验收：「已保存：文件名」单独一行、浅色，不和说明挤在同一段
function setFileLine(progressIndicator, detailEl, file) {
  let fileEl = progressIndicator.querySelector('.progress-file');
  if (!file) {
    if (fileEl) fileEl.remove();
    return;
  }
  if (!fileEl) {
    fileEl = document.createElement('div');
    fileEl.className = 'progress-file';
    if (detailEl) detailEl.after(fileEl);
    else progressIndicator.appendChild(fileEl);
  }
  fileEl.textContent = file;
}

export function clearProgressState() {
  cancelAutoHide(); // rp2c ④：手动关闭 / 清掉卡片时一并取消自动收起计时
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (!progressIndicator) return;
  removeResultActions(progressIndicator);
  progressIndicator.style.display = 'none';
  progressIndicator.classList.remove('error', 'success', 'warning', 'submitted');
  const icon = progressIndicator.querySelector('.progress-icon');
  if (icon) icon.remove();
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
  setFileLine(progressIndicator, detailEl, '');
}

/** Round 3 C-2：popup 发起的转换要拿到结果（成功文件名 / 失败原因），一次性回调 */
let outcomeWaiters = [];
export function onNextOutcome(cb) { outcomeWaiters.push(cb); }
export function notifyOutcome(outcome) {
  const list = outcomeWaiters; outcomeWaiters = [];
  list.forEach((cb) => { try { cb(outcome); } catch (_) { /* popup 已关闭 */ } });
}

export function showError(message) {
  notifyOutcome({ ok: false, error: message || t.content_error_generic });
  setProgressState({
    text: t.content_progress_failed,
    detail: message || t.content_error_generic,
    percent: null,
    state: 'error',
  });
  reportShortcutFailure();
}

/**
 * batch9 设计验收 M3/S3：PDF 下载被取消或已从下载列表移除——标题「已取消」而不是「失败」，
 * 读屏用 status/polite。样式暂时沿用错误卡片（中性「已取消」样式在 backlog）。
 */
export function showCanceled(message) {
  notifyOutcome({ ok: false, error: message || t.content_error_download_canceled });
  setProgressState({
    text: t.content_progress_canceled,
    detail: message || t.content_error_download_canceled,
    percent: null,
    state: 'error',
    polite: true,
  });
  reportShortcutFailure();
}

/** 让后台把快捷键徽标从「…」换成「!」；不是快捷键发起的转换，后台会忽略 */
export function reportShortcutFailure() { sendShortcutResult({ ok: false }); }
/** H-01：重复任务用户取消/强制提交成功——让后台直接清除徽标 */
export function reportShortcutClear() { sendShortcutResult({ clear: true }); }
function sendShortcutResult(extra) {
  try {
    const r = chrome.runtime.sendMessage({ type: 'SHORTCUT_RESULT', ...extra });
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch (_) { /* 扩展已重载，消息发不出去 */ }
}

/** 成功 / 已提交提示至少停留这么久（WCAG 2.2.1：给足阅读时间；rp2c 设计终验 ④：8 秒 → 10 秒），同时提供关闭按钮 */
export const SUCCESS_VISIBLE_MS = 10000;
/** rp2c ④：暂停后恢复时至少再留这么久，避免移出后立刻消失 */
export const AUTO_HIDE_RESUME_MIN_MS = 2000;
let successTimer = null;

/*
 * rp2c（设计终验 ④，WCAG 2.2.1 / 2.2.2）：自动收起的计时
 * —— 页面上只有一张 .arxiv-md-progress 卡片，successTimer 是模块级、唯一的一份：
 *    「已完成」和「已提交」两种卡片共用它；pending / 新的转换 / 关闭会取消它；错误卡片本来就不自动收起。
 * —— 鼠标悬停或焦点在卡片内：暂停，记下剩余时间；时间到时若仍悬停/有焦点也不收起（焦点在内永不收起）。
 * —— 鼠标和焦点都离开后：按剩余时间继续（至少 2 秒），不是重新计时。
 * —— 收起就是 display:none，卡片本身没有过渡动画，减少动态偏好下也一样。
 */
let autoHideState = null; // { state, remaining, startedAt }
let cardHovered = false;

function cardHasFocus(el) {
  const a = document.activeElement;
  return !!(a && a !== document.body && el.contains(a));
}

function pauseAutoHide() {
  if (!autoHideState || successTimer == null) return;
  clearTimeout(successTimer);
  successTimer = null;
  autoHideState.remaining = Math.max(AUTO_HIDE_RESUME_MIN_MS, autoHideState.remaining - (Date.now() - autoHideState.startedAt));
}

function scheduleAutoHide() {
  const el = document.querySelector('.arxiv-md-progress');
  if (!autoHideState || !el || successTimer != null) return;
  if (cardHovered || cardHasFocus(el)) return; // 仍暂停
  const st = autoHideState;
  st.startedAt = Date.now();
  successTimer = setTimeout(() => {
    successTimer = null;
    const cur = document.querySelector('.arxiv-md-progress');
    // 期间若已开始下一次转换（状态变了），不要误清
    if (!cur || autoHideState !== st || !cur.classList.contains(st.state)) return;
    if (cardHovered || cardHasFocus(cur)) { st.remaining = AUTO_HIDE_RESUME_MIN_MS; return; }
    autoHideState = null;
    clearProgressState();
  }, st.remaining);
}

function bindAutoHidePause(el) {
  if (!el || el.dataset.amdAutoHideBound === '1') return;
  el.dataset.amdAutoHideBound = '1';
  el.addEventListener('mouseenter', () => { cardHovered = true; pauseAutoHide(); });
  el.addEventListener('mouseleave', () => { cardHovered = false; scheduleAutoHide(); });
  el.addEventListener('focusin', () => pauseAutoHide());
  el.addEventListener('focusout', (e) => {
    if (!autoHideState) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return; // 焦点仍在卡片内
    // focusout 时 activeElement 可能还是旧元素，下一拍再判断
    setTimeout(() => scheduleAutoHide(), 0);
  });
}

function startAutoHide(state) {
  cancelAutoHide();
  const el = document.querySelector('.arxiv-md-progress');
  autoHideState = { state, remaining: SUCCESS_VISIBLE_MS, startedAt: Date.now() };
  // rp2c 复审 P2：悬停时点「关闭」不会再有 mouseleave，cardHovered 会卡在 true；按指针的真实位置复位
  try { cardHovered = !!(el && el.matches(':hover')); } catch (_) { cardHovered = false; }
  bindAutoHidePause(el);
  scheduleAutoHide();
}

function cancelAutoHide() {
  autoHideState = null;
  clearTimeout(successTimer);
  successTimer = null;
}

export function showSuccess(message) {
  notifyOutcome({ ok: true, message: message || '' });
  setProgressState({
    text: t.content_progress_completed,
    detail: message || '',
    percent: 100,
    state: 'success',
  });

  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (progressIndicator) {
    const actions = document.createElement('div');
    actions.className = 'arxiv-md-result-actions';
    actions.appendChild(createCloseButton());
    progressIndicator.appendChild(actions);
  }

  startAutoHide('success');
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function clockIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'progress-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '9');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M12 7v5l3 2');
  svg.append(c, path);
  return svg;
}

/**
 * rp2b（设计 ③，与 popup S-2 一致）：异步后端（PaddleOCR / MinerU）提交成功≠完成。
 * 标题「已提交」，无百分比、无进度条；时钟图标 + 信息蓝；只有「关闭」；读屏 polite。
 */
export function showSubmitted(providerId) {
  notifyOutcome({ ok: true, submitted: true, message: t.content_progress_submitted });
  const label = providerId ? providerLabel(providerId) : provider;
  setProgressState({
    text: t.content_progress_submitted,
    detail: String(t.content_submitted_body || '').replace(/\{provider\}/g, label),
    percent: null,
    state: 'submitted',
  });
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (progressIndicator) {
    const row = progressIndicator.querySelector('.progress-row');
    if (row) row.prepend(clockIcon());
    const actions = document.createElement('div');
    actions.className = 'arxiv-md-result-actions';
    actions.appendChild(createCloseButton());
    progressIndicator.appendChild(actions);
  }
  // 与已完成提示一样 10 秒后收起（rp2c：悬停/焦点暂停）（系统通知会在完成时再提醒）；期间开始新转换则不误清
  startAutoHide('submitted');
}

/**
 * batch9 ①：4 分钟后下载仍在继续——中性（进行中）样式，不显示百分比，
 * 标题「仍在下载」，不声称已完成或失败；带关闭按钮，不自动收起（M2）。
 */
export function showPending(message, downloadId = null) {
  notifyOutcome({ ok: true, pending: true, message: message || '' });
  setProgressState({
    text: t.content_progress_still_downloading,
    detail: message || '',
    percent: null,
    state: '',
  });
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (progressIndicator) {
    progressIndicator.dataset.pending = '1';
    // batch9 P3①：记住是哪一次下载，后来的 PDF_DOWNLOAD_SETTLED 只认同一个 id
    if (downloadId != null) progressIndicator.dataset.downloadId = String(downloadId);
    else delete progressIndicator.dataset.downloadId;
    const actions = document.createElement('div');
    actions.className = 'arxiv-md-result-actions';
    actions.appendChild(createCloseButton());
    progressIndicator.appendChild(actions);
  }
  // batch9 M2（Simon 决定）：pending 不自动收起，留到用户点「关闭」、新的转换替换它，或下载补完成（settlePending）
  cancelAutoHide();
}

/** batch9 M2：页面上是否仍是 pending 卡片；P3①：给了 downloadId 时还要是同一次下载 */
export function isPendingShown(downloadId = null) {
  const el = document.querySelector('.arxiv-md-progress');
  if (!el || el.dataset.pending !== '1' || el.style.display === 'none') return false;
  if (downloadId == null || el.dataset.downloadId == null) return true;
  return el.dataset.downloadId === String(downloadId);
}

/** batch9 M2：后台报告 pending 的下载后来完成了——仍显示 pending 卡片时换成「已完成」 */
export function settlePending(message, downloadId = null) {
  if (!isPendingShown(downloadId)) return false;
  showSuccess(message);
  return true;
}

function createCloseButton() {
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'arxiv-md-result-btn arxiv-md-result-close';
  closeButton.textContent = t.content_btn_close;
  closeButton.addEventListener('click', () => clearProgressState());
  return closeButton;
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
export function showResult({ filename = '', markdown = '', integrity = null, emptyContent = false } = {}) {
  notifyOutcome({ ok: true, filename, incomplete: !!integrity || emptyContent });
  // AR-02：HTML 没有正文，已改存 PDF——警告态，不显示「已完成」，提示可用 PDF 解析
  if (emptyContent) {
    setProgressState({
      text: t.content_progress_empty,
      detail: t.content_result_empty,
      file: filename ? t.content_result_saved.replace('{filename}', filename) : '',
      percent: null,
      state: 'warning',
    });
    return;
  }
  const saved = filename ? t.content_result_saved.replace('{filename}', filename) : '';
  // AF3-01：导出明显少于页面——文件照常保存，提示改为警告并给出节数
  const warning = integrity
    ? t.content_result_incomplete
      .replace('{expected}', String(integrity.expectedSections))
      .replace('{actual}', String(integrity.exportedSections))
    : '';
  setProgressState({
    text: integrity ? t.content_progress_incomplete : t.content_progress_completed,
    detail: integrity ? warning : saved,
    file: integrity ? saved : '',
    percent: null,
    state: integrity ? 'warning' : 'success',
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

  actions.appendChild(createCloseButton());
  actions.appendChild(status);

  progressIndicator.appendChild(actions);
}
