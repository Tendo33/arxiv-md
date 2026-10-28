// Settings 页面逻辑

import storage from '@utils/storage';
import { CONVERSION_MODE } from '@config/constants';
import logger from '@utils/logger';

import { translations } from '@config/locales';
import { bindInstantSave } from './instant-save';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection } from './pdf-provider';

const pdfSection = createPdfProviderSection({
  doc: document,
  storage,
  permissions: chrome.permissions,
  registry: createDefaultRegistry(),
  t: () => translations[currentLang],
  toast: (m, type) => showToast(m, type),
});

let currentLang = 'en'; // init() 中会换成已保存的语言，未保存时跟随浏览器（storage.getLanguage）

document.addEventListener('DOMContentLoaded', init);

async function init() {
  logger.debug('Settings page initialized');

  // 加载语言设置
  const savedLang = await storage.getLanguage();
  currentLang = savedLang;
  updateLanguage(currentLang);

  // 检查是否是首次安装
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('welcome') === 'true') {
    document.getElementById('welcomeBanner').style.display = 'block';
  }

  // 加载设置
  await loadSettings();

  // 加载统计
  await loadStatistics();

  // 设置版本号
  const manifest = chrome.runtime.getManifest();
  document.getElementById('versionDisplay').textContent = `v${manifest.version}`;
  document.getElementById('aboutVersion').textContent = `v${manifest.version}`;

  // 绑定事件
  bindEvents();
}

function updateLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];

  // 更新所有带 data-i18n 属性的元素
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  // 更新 placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });

  // 更新 title 属性
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) {
      el.title = t[key];
    }
  });

  // 更新 aria-label
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (t[key]) {
      el.setAttribute('aria-label', t[key]);
    }
  });

  // 更新语言按钮文本
  document.getElementById('langText').textContent =
    lang === 'en' ? '中文' : 'English';

  // 保存语言设置
  storage.setLanguage(lang);
}

async function loadSettings() {
  try {
    const mode = await storage.getConversionMode();
    document.querySelector(
      `input[name="conversionMode"][value="${mode}"]`,
    ).checked = true;

    await pdfSection.init();

    const showNotifications = await storage.getShowNotifications();
    document.getElementById('showNotifications').checked = showNotifications;

    const autoConvert = await storage.getAutoConvert();
    document.getElementById('autoConvert').checked = autoConvert;

    const includeMetadata = await storage.getIncludeMetadata();
    document.getElementById('includeMetadata').checked = includeMetadata;

    document.getElementById('showPdfFab').checked = await storage.getShowPdfFab();

    logger.info('Settings loaded');
  } catch (error) {
    logger.error('Failed to load settings:', error);
    showToast('Failed to load settings', 'error');
  }
}

async function loadStatistics() {
  try {
    const stats = await storage.getStatistics();

    document.getElementById('totalConversions').textContent =
      stats.totalConversions || 0;
    document.getElementById('ar5ivSuccess').textContent =
      stats.ar5ivSuccess || 0;
    document.getElementById('mineruSuccess').textContent =
      stats.mineruSuccess || 0;
    document.getElementById('pdfFallback').textContent = stats.pdfFallback || 0;
  } catch (error) {
    logger.error('Failed to load statistics:', error);
  }
}

function bindEvents() {
  // 语言切换
  document.getElementById('langToggle').addEventListener('click', () => {
    const newLang = currentLang === 'en' ? 'zh' : 'en';
    updateLanguage(newLang);
    pdfSection.render();
  });

  // R4-14：后端选择 / 授权 / 撤销 / 测试连接
  pdfSection.bind();

  // 即时保存（A3-3）：每项改动立刻写入，不再有「保存」按钮
  bindInstantSave(document, storage, {
    onSaved: () => showToast(translations[currentLang].toast_saved, 'success'),
    onError: (error) => {
      logger.error('Failed to save setting:', error);
      showToast(`${translations[currentLang].toast_save_failed} ${error.message}`, 'error');
    },
  });

  // 恢复默认
  document.getElementById('resetBtn').addEventListener('click', resetSettings);

  // Toggle Token 可见性
  document
    .getElementById('toggleTokenBtn')
    .addEventListener('click', toggleTokenVisibility);

  // 重置统计
  document
    .getElementById('resetStatsBtn')
    .addEventListener('click', resetStatistics);

  // Key 输入格式提示
  document
    .getElementById('providerKey')
    .addEventListener('blur', validateToken);
  // 开始填 Key 后，“请在本设备重新填写”提示就不需要了
  document.getElementById('providerKey').addEventListener('input', (e) => {
    const hint = document.getElementById('keyHereHint');
    if (hint && e.target.value.trim()) { hint.hidden = true; hint.textContent = ''; }
  });
}

async function resetSettings() {
  const t = translations[currentLang];
  if (!confirm(t.confirm_reset)) return;

  try {
    // 恢复默认模式 (FAST)
    await storage.setConversionMode(CONVERSION_MODE.FAST);
    document.querySelector(
      `input[name="conversionMode"][value="${CONVERSION_MODE.FAST}"]`,
    ).checked = true;

    // R4-06：清除全部 Key（只在 storage.local）
    document.getElementById('providerKey').value = '';
    await storage.clearProviderKeys();
    document.getElementById('tokenStatus').style.display = 'none';
    await pdfSection.render();

    // 重置高级选项
    document.getElementById('autoConvert').checked = false;
    await storage.setAutoConvert(false);

    document.getElementById('includeMetadata').checked = true;
    await storage.setIncludeMetadata(true);

    document.getElementById('showPdfFab').checked = true;
    await storage.setShowPdfFab(true);

    showToast(t.toast_reset, 'success');
  } catch (error) {
    logger.error('Failed to reset settings:', error);
    showToast('Failed to reset: ' + error.message, 'error');
  }
}

function toggleTokenVisibility() {
  const input = document.getElementById('providerKey');
  const btn = document.getElementById('toggleTokenBtn');
  btn.setAttribute('aria-pressed', input.type === 'password' ? 'true' : 'false');

  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    `;
  } else {
    input.type = 'password';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
  }
}

async function validateToken() {
  const token = document.getElementById('providerKey').value.trim();
  const statusEl = document.getElementById('tokenStatus');

  if (!token) {
    statusEl.style.display = 'none';
    return;
  }

  const t = translations[currentLang];

  // 简单的格式验证
  if (token.length < 10) {
    statusEl.style.display = 'block';
    statusEl.className = 'token-status error';
    statusEl.textContent = t.token_invalid;
    return;
  }

  // 格式检查通过，显示提示
  statusEl.style.display = 'block';
  statusEl.className = 'token-status success';
  statusEl.textContent = t.token_valid;
}

async function resetStatistics() {
  const t = translations[currentLang];
  if (!confirm(t.confirm_stats_reset)) return;

  try {
    await storage.set('statistics', {
      totalConversions: 0,
      ar5ivSuccess: 0,
      mineruSuccess: 0,
      pdfFallback: 0,
      lastConversionTime: null,
    });

    await loadStatistics();
    showToast(t.toast_stats_reset, 'success');
  } catch (error) {
    logger.error('Failed to reset statistics:', error);
    showToast('Failed to reset: ' + error.message, 'error');
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const messageEl = toast.querySelector('.toast-message');

  messageEl.textContent = message;
  if (type === 'error') {
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
  } else {
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
  }
  toast.setAttribute('aria-atomic', 'true');
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
