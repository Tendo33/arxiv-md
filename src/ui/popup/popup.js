// Popup v2（Round 3 C-2）：当前页上下文 + 三个导出动作 + 最近 MinerU 任务

import { keyHereMessage, renderKeyHint } from './key-hint';
import { ctxBadgeState } from './ctx-badge';
import logger from '@utils/logger';
import storage from '@utils/storage';
import { translations } from '@config/locales';
import { showConfirm } from './confirm-dialog';
import { confirmSendFlow, refocusTask } from './send-consent';
import { renderTaskRows, setTaskListLanguage } from './task-list';
import { bindListScroll, fitListToHalfRow, refitOnResize } from './list-scroll';
import { NW_ZH, setNwText } from '../settings/nw-segments';
import { pageContext, recentTasks } from './page-context';
import { renderShortcutGuide } from './shortcut-guide';
import { providerLabel } from '@config/pdf-providers';

let currentTasks = [];
let currentLang = 'en';
let reloadTimer = null;
let ctx = { supported: false };
let tabId = null;
let showAll = false;
let busy = false;
let lastMode = 'markdown';
let active = { id: 'paddleocr', hasKey: false };

const $ = (id) => document.getElementById(id);
const t = () => translations[currentLang];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await initLanguage();
  $('settingsBtn').addEventListener('click', openSettings);
  $('keySettingsBtn').addEventListener('click', openSettings);
  $('clearCompletedBtn').addEventListener('click', clearCompleted);
  $('recentAll').addEventListener('click', () => { showAll = !showAll; renderRecent(); });
  $('refreshBtn').addEventListener('click', () => {
    if (tabId != null) Promise.resolve(chrome.tabs.reload(tabId)).catch(() => {});
    window.close();
  });
  $('exportBtn').addEventListener('click', () => runExport('markdown'));
  $('mineruBtn').addEventListener('click', () => runExport('mineru'));
  $('pdfBtn').addEventListener('click', () => runExport('pdf'));
  $('footerVersion').textContent = `v${chrome.runtime.getManifest().version}`;
  bindTaskActions();
  loadShortcut();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id ?? null;
    ctx = pageContext(tab);
  } catch (error) {
    logger.warn('tabs.query failed:', error);
  }
  await loadActiveProvider();
  renderContext();
  await loadTasks();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.mineruTasks) scheduleLoadTasks();
    if (area === 'sync' && changes.language) updateLanguage(changes.language.newValue);
    if ((area === 'sync' && changes.pdfProvider) || (area === 'local' && changes.providerKeys)) loadActiveProvider();
  });
}

// 快捷键没注册上（被浏览器/其他扩展占用）时显示「去设置」引导
let shortcutCmds = null;
async function loadShortcut() {
  if (!chrome.commands?.getAll) return;
  try {
    shortcutCmds = await chrome.commands.getAll();
    renderShortcut();
  } catch (error) {
    logger.warn('commands.getAll failed:', error);
  }
}

function renderShortcut() {
  if (!shortcutCmds) return;
  renderShortcutGuide(document, shortcutCmds, navigator.userAgent, t(), (url) => {
    Promise.resolve(chrome.tabs.create({ url })).catch(() => {});
  });
}

/** R4-15：按钮旁小字显示当前后端 */
async function loadActiveProvider() {
  try { active = await storage.getActivePdfProvider(); } catch (error) { logger.warn('provider lookup failed:', error); }
  renderBackend();
}

function renderBackend() {
  const el = $('backendLabel');
  if (el) el.textContent = (t().popup_backend || '({provider})').replace('{provider}', providerLabel(active.id));
  // 复审 P2-A：后端随 sync 过来了，但 Key 不同步 → 打开弹窗就提示在本设备重新填写
  renderKeyHint(document, active, t(), providerLabel(active.id));
}

function scheduleLoadTasks() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { reloadTimer = null; loadTasks(); }, 120);
}

async function initLanguage() {
  updateLanguage(await storage.getLanguage());
}

function updateLanguage(lang) {
  currentLang = translations[lang] ? lang : 'en';
  setTaskListLanguage(currentLang);
  const tr = t();
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (tr[key]) el.textContent = tr[key];
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (tr[key]) el.title = tr[key];
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (tr[key]) el.setAttribute('aria-label', tr[key]);
  });
  renderBackend();
  renderContext();
  renderRecent();
  renderShortcut();
}

function setBadge(cls, text) {
  const b = $('ctxBadge');
  b.className = `badge ${cls}`;
  b.textContent = text;
}

function renderContext() {
  const tr = t();
  const supported = ctx.supported;
  $('ctxCard').classList.toggle('hidden', !supported);
  $('unsupported').classList.toggle('hidden', supported);
  const disabled = !supported || ctx.loading || busy;
  ['exportBtn', 'mineruBtn', 'pdfBtn'].forEach((id) => { $(id).disabled = disabled; });
  $('alertInfo').classList.toggle('hidden', !(supported && ctx.loading));
  if (!supported) return;
  $('ctxTitle').textContent = ctx.title;
  $('ctxTitle').title = ctx.title;
  $('ctxMeta').textContent = `arXiv:${ctx.arxivId}`;
  const [cls, text] = ctxBadgeState({ busy, loading: ctx.loading, state: ctx.state, kind: ctx.kind }, tr);
  setBadge(cls, text);
}

function setBusy(on) {
  busy = on;
  const btn = $(lastMode === 'markdown' ? 'exportBtn' : lastMode === 'mineru' ? 'mineruBtn' : 'pdfBtn');
  $('exportBtn').querySelector('.spinner').classList.toggle('hidden', !(on && lastMode === 'markdown'));
  $('exportBtn').querySelector('.btn-icon').classList.toggle('hidden', on && lastMode === 'markdown');
  btn.setAttribute('aria-busy', on ? 'true' : 'false');
  $('ctxProg').classList.toggle('hidden', !on);
  if (on) { $('ctxProgText').textContent = t().popup_converting; $('ctxProgPct').textContent = ''; $('ctxProgBar').style.width = ''; }
  // 设计建议 S-1：没有真实进度，用和页面进度卡同一个不确定动画，不再写死固定宽度
  $('ctxProgBar').parentElement.classList.toggle('indeterminate', on);
  renderContext();
}

function hideAlerts() {
  $('alertOk').classList.add('hidden');
  $('alertErr').classList.add('hidden');
}

// 设计验收 B1：PDF 解析只是「已提交」，不能显示「已完成 / 已保存」；title 缺省时是「已保存」
function showOk(text, title = null, state = 'ok') {
  hideAlerts();
  ctx.state = state;
  $('okTitle').textContent = title || t().popup_saved;
  $('okFile').textContent = text ? ` · ${text}` : '';
  // 设计建议 S-2：已提交≠已完成，用时钟图标和蓝色信息色，不用绿色 ✓
  const pending = state === 'submitted';
  $('alertOk').classList.toggle('pending', pending);
  $('okIconDone').classList.toggle('hidden', pending);
  $('okIconPending').classList.toggle('hidden', !pending);
  $('alertOk').classList.remove('hidden');
}

function showNeedKey(title, hint) {
  hideAlerts();
  $('keyHereTitle').textContent = title;
  // R09：zh 按短语 .nw 分段（表见 nw-segments.js）；没有手工表的走 splitZh 兜底
  const key = Object.keys(NW_ZH).find((k) => NW_ZH[k].join('') === hint) || '';
  setNwText($('keyHereHint'), key, hint || '', currentLang);
  $('alertKey').classList.remove('hidden');
}

function showErr(title, hint) {
  hideAlerts();
  ctx.state = 'err';
  showRefresh(false);
  $('errTitle').textContent = title;
  $('errHint').textContent = hint ? ` ${hint}` : '';
  $('alertErr').classList.remove('hidden');
}

/** 设计验收 R3：「无法连接页面」补刷新按钮（与 zhihu 一致） */
function showRefresh(show) {
  $('refreshBtn').classList.toggle('hidden', !show);
}

async function runExport(mode) {
  if (busy || !ctx.supported || tabId == null) return;
  lastMode = mode;
  hideAlerts();
  const tr = t();
  if (mode === 'mineru') {
    await loadActiveProvider();
    if (!active.hasKey) {
      const here = keyHereMessage(active, tr, providerLabel(active.id));
      // 设计建议 A：缺 Key 不是失败，用现有的 info 提示框（#alertKey）加「打开设置」，红框只留给真正的错误
      if (here) showNeedKey(here.title, here.hint);
      else showNeedKey(tr.popup_err_token_title.replace('{provider}', providerLabel(active.id)), tr.popup_err_token_hint);
      ctx.state = 'needkey'; // 设计复核 S1：没有任务失败，卡片用中性的「需要 Key」
      renderContext();
      return;
    }
  }
  setBusy(true);
  let res = null;
  try {
    res = await chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_CONVERSION', mode, reply: true });
  } catch (error) {
    logger.warn('TRIGGER_CONVERSION failed:', error);
    res = { ok: false, error: tr.popup_err_unreachable, unreachable: true };
  }
  setBusy(false);
  if (res && res.ok) {
    if (mode === 'mineru') showOk(tr.popup_saved_bg.replace('{provider}', providerLabel(active.id)), tr.content_progress_submitted, 'submitted');
    else showOk(res.filename || res.message || '');
  } else if (res?.notice) {
    // 设计验收 30a6e1b #5：C10 拦截不是失败，用中性 info 卡（#alertKey，role=status），不用 showErr
    showNeedKey(res.title || tr.pdf_disc_needed_title, res.hint || tr.pdf_disc_needed_body);
    ctx.state = 'notice';
  } else {
    showErr(res?.error || tr.popup_badge_err, res?.unreachable ? '' : tr.popup_err_generic_hint);
    showRefresh(!!res?.unreachable);
  }
  renderContext();
}

async function loadTasks() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TASKS' });
    if (response && response.success) {
      currentTasks = response.tasks || [];
      renderRecent();
    } else {
      logger.error('Failed to load tasks:', response?.error);
    }
  } catch (error) {
    logger.error('Failed to load tasks:', error);
  }
}

function renderRecent() {
  const wrap = $('recent');
  if (!wrap) return;
  const tr = t();
  wrap.classList.remove('hidden');
  const empty = !currentTasks.length;
  $('recentEmpty').classList.toggle('hidden', !empty);
  $('taskList').classList.toggle('hidden', empty);
  if (empty) { $('recentAll').classList.add('hidden'); $('clearCompletedBtn').classList.add('hidden'); return; }
  const list = showAll ? recentTasks(currentTasks, Infinity) : recentTasks(currentTasks, 3);
  // 设计验收 M8：重绘会替换掉行内按钮；焦点原本在任务行里就按 taskId 找回来，不让它掉到 body
  const focused = document.activeElement;
  const keepId = focused && $('taskList').contains(focused) && focused.dataset ? focused.dataset.taskId : null;
  renderTaskRows($('taskList'), list, document);
  if (keepId) refocusTask(document, keepId);
  fitListToHalfRow($('taskList')); // 设计 D6（AX-10）
  const more = currentTasks.length > 3;
  const all = $('recentAll');
  all.classList.toggle('hidden', !more);
  all.textContent = showAll ? tr.popup_recent_less : tr.popup_recent_all.replace('{n}', currentTasks.length);
  all.setAttribute('aria-expanded', String(showAll));
  const hasDone = currentTasks.some((x) => x.status === 'completed' || x.status === 'failed');
  $('clearCompletedBtn').classList.toggle('hidden', !(showAll && hasDone));
}

function bindTaskActions() {
  bindListScroll($('taskList'), window);
  refitOnResize($('statusZone'), $('taskList'), window); // 必须改 6：showNeedKey/hideAlerts 后重算
  $('taskList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, taskId, url } = btn.dataset;
    if (action === 'download') handleDownload(url);
    else if (action === 'retry') await handleRetry(taskId);
    else if (action === 'consent') await handleConsent(taskId, btn.dataset.provider);
    else if (action === 'disclose') chrome.runtime.sendMessage({ type: 'OPEN_DISCLOSURE', provider: btn.dataset.provider });
    else if (action === 'delete') await handleDelete(taskId);
  });
}

function handleDownload(url) {
  chrome.downloads.download({ url }, () => {
    if (chrome.runtime.lastError) logger.error('Download failed:', chrome.runtime.lastError);
  });
}

async function taskCall(message, okKey, failKey, extra) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (response && response.success) {
      showToast(extra ? t()[okKey].replace('{n}', response.cleared) : t()[okKey]);
      await loadTasks();
    } else showToast(t()[failKey]);
  } catch (error) {
    logger.error(`${message.type} failed:`, error);
    showToast(t()[failKey]);
  }
}

async function handleConsent(taskId, providerId) {
  const task = currentTasks.find((x) => x.id === taskId) || taskId;
  await confirmSendFlow(task, providerId, { showConfirm, sendMessage: (m) => chrome.runtime.sendMessage(m), tr: t() });
  await loadTasks();
  refocusTask(document, taskId);
}

async function handleRetry(taskId) {
  await taskCall({ type: 'RETRY_TASK', taskId }, 'popup_toast_retry_success', 'popup_toast_retry_failed');
}

async function handleDelete(taskId) {
  if (!(await showConfirm(t().popup_confirm_delete))) return;
  await taskCall({ type: 'DELETE_TASK', taskId }, 'popup_toast_delete_success', 'popup_toast_delete_failed');
}

async function clearCompleted() {
  if (!(await showConfirm(t().popup_confirm_clear))) return;
  await taskCall({ type: 'CLEAR_COMPLETED_TASKS' }, 'popup_toast_clear_success', 'popup_toast_clear_failed', true);
}

function openSettings() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2000);
}
