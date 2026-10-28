// Popup v2（Round 3 C-2）：当前页上下文 + 三个导出动作 + 最近 MinerU 任务

import logger from '@utils/logger';
import storage from '@utils/storage';
import { translations } from '@config/locales';
import { showConfirm } from './confirm-dialog';
import { createTaskRow, setTaskListLanguage } from './task-list';
import { pageContext, recentTasks } from './page-context';

let currentTasks = [];
let currentLang = 'en';
let reloadTimer = null;
let ctx = { supported: false };
let tabId = null;
let showAll = false;
let busy = false;
let lastMode = 'markdown';

const $ = (id) => document.getElementById(id);
const t = () => translations[currentLang];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await initLanguage();
  $('settingsBtn').addEventListener('click', openSettings);
  $('clearCompletedBtn').addEventListener('click', clearCompleted);
  $('recentAll').addEventListener('click', () => { showAll = !showAll; renderRecent(); });
  $('exportBtn').addEventListener('click', () => runExport('markdown'));
  $('mineruBtn').addEventListener('click', () => runExport('mineru'));
  $('pdfBtn').addEventListener('click', () => runExport('pdf'));
  $('footerVersion').textContent = `v${chrome.runtime.getManifest().version}`;
  bindTaskActions();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id ?? null;
    ctx = pageContext(tab);
  } catch (error) {
    logger.warn('tabs.query failed:', error);
  }
  renderContext();
  await loadTasks();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.mineruTasks) scheduleLoadTasks();
    if (area === 'sync' && changes.language) updateLanguage(changes.language.newValue);
  });
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
  renderContext();
  renderRecent();
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
  if (busy) setBadge('run', tr.popup_badge_run);
  else if (ctx.loading) setBadge('dis', tr.popup_badge_dis);
  else if (ctx.state === 'ok') setBadge('ok', tr.popup_badge_ok);
  else if (ctx.state === 'err') setBadge('err', tr.popup_badge_err);
  else setBadge('idle', tr[`popup_badge_${ctx.kind}`]);
}

function setBusy(on) {
  busy = on;
  const btn = $(lastMode === 'markdown' ? 'exportBtn' : lastMode === 'mineru' ? 'mineruBtn' : 'pdfBtn');
  $('exportBtn').querySelector('.spinner').classList.toggle('hidden', !(on && lastMode === 'markdown'));
  $('exportBtn').querySelector('.btn-icon').classList.toggle('hidden', on && lastMode === 'markdown');
  btn.setAttribute('aria-busy', on ? 'true' : 'false');
  $('ctxProg').classList.toggle('hidden', !on);
  if (on) { $('ctxProgText').textContent = t().popup_converting; $('ctxProgPct').textContent = ''; $('ctxProgBar').style.width = '40%'; }
  renderContext();
}

function hideAlerts() {
  $('alertOk').classList.add('hidden');
  $('alertErr').classList.add('hidden');
}

function showOk(text) {
  hideAlerts();
  ctx.state = 'ok';
  $('okFile').textContent = text ? ` · ${text}` : '';
  $('alertOk').classList.remove('hidden');
}

function showErr(title, hint) {
  hideAlerts();
  ctx.state = 'err';
  $('errTitle').textContent = title;
  $('errHint').textContent = hint ? ` ${hint}` : '';
  $('alertErr').classList.remove('hidden');
}

async function runExport(mode) {
  if (busy || !ctx.supported || tabId == null) return;
  lastMode = mode;
  hideAlerts();
  const tr = t();
  if (mode === 'mineru') {
    const token = await storage.getMinerUToken();
    if (!token) {
      showErr(tr.popup_err_token_title, tr.popup_err_token_hint);
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
    showOk(mode === 'mineru' ? tr.popup_saved_bg : (res.filename || res.message || ''));
  } else {
    showErr(res?.error || tr.popup_badge_err, res?.unreachable ? '' : tr.popup_err_generic_hint);
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
  if (!currentTasks.length) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  const list = showAll ? recentTasks(currentTasks, Infinity) : recentTasks(currentTasks, 3);
  $('taskList').innerHTML = list.map(createTaskRow).join('');
  const more = currentTasks.length > 3;
  const all = $('recentAll');
  all.classList.toggle('hidden', !more);
  all.textContent = showAll ? tr.popup_recent_less : tr.popup_recent_all.replace('{n}', currentTasks.length);
  all.setAttribute('aria-expanded', String(showAll));
  const hasDone = currentTasks.some((x) => x.status === 'completed' || x.status === 'failed');
  $('clearCompletedBtn').classList.toggle('hidden', !(showAll && hasDone));
}

function bindTaskActions() {
  $('taskList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, taskId, url } = btn.dataset;
    if (action === 'download') handleDownload(url);
    else if (action === 'retry') await handleRetry(taskId);
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
