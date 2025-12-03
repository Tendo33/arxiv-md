// Settings 页面逻辑 - 配置管理、Token 验证、统计展示

import storage from "@utils/storage";
import { CONVERSION_MODE } from "@config/constants";
import logger from "@utils/logger";

import { translations } from "@config/locales";

let currentLang = "en";

document.addEventListener("DOMContentLoaded", init);

/**
 * 初始化
 */
async function init() {
  logger.debug("Settings page initialized");

  // 加载语言设置
  const savedLang = await storage.getLanguage();
  currentLang = savedLang;
  updateLanguage(currentLang);

  // 检查是否是首次安装
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("welcome") === "true") {
    document.getElementById("welcomeBanner").style.display = "block";
  }

  // 加载设置
  await loadSettings();

  // 加载统计
  await loadStatistics();

  // 绑定事件
  bindEvents();
}

/**
 * 更新页面语言
 */
function updateLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];
  
  // 更新所有带 data-i18n 属性的元素
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  // 更新 placeholder
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (t[key]) {
      el.placeholder = t[key];
    }
  });

  // 更新语言按钮文本
  document.getElementById("langText").textContent = lang === "en" ? "中文" : "English";
  
  // 保存语言设置
  storage.setLanguage(lang);
}

/**
 * 加载设置
 */
async function loadSettings() {
  try {
    const mode = await storage.getConversionMode();
    document.querySelector(
      `input[name="conversionMode"][value="${mode}"]`,
    ).checked = true;

    const token = await storage.getMinerUToken();
    if (token) {
      document.getElementById("mineruToken").value = token;
    }

    const showNotifications = await storage.getShowNotifications();
    document.getElementById("showNotifications").checked = showNotifications;

    logger.info("Settings loaded");
  } catch (error) {
    logger.error("Failed to load settings:", error);
    showToast("Failed to load settings", "error");
  }
}

/**
 * 加载统计数据
 */
async function loadStatistics() {
  try {
    const stats = await storage.getStatistics();

    document.getElementById("totalConversions").textContent =
      stats.totalConversions || 0;
    document.getElementById("ar5ivSuccess").textContent =
      stats.ar5ivSuccess || 0;
    document.getElementById("mineruSuccess").textContent =
      stats.mineruSuccess || 0;
    document.getElementById("pdfFallback").textContent = stats.pdfFallback || 0;
  } catch (error) {
    logger.error("Failed to load statistics:", error);
  }
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 语言切换
  document.getElementById("langToggle").addEventListener("click", () => {
    const newLang = currentLang === "en" ? "zh" : "en";
    updateLanguage(newLang);
  });

  // 保存设置
  document.getElementById("saveBtn").addEventListener("click", saveSettings);

  // 恢复默认
  document.getElementById("resetBtn").addEventListener("click", resetSettings);

  // Toggle Token 可见性
  document
    .getElementById("toggleTokenBtn")
    .addEventListener("click", toggleTokenVisibility);

  // 重置统计
  document
    .getElementById("resetStatsBtn")
    .addEventListener("click", resetStatistics);

  // Token 输入验证
  document
    .getElementById("mineruToken")
    .addEventListener("blur", validateToken);
}

/**
 * 保存设置
 */
async function saveSettings() {
  const btn = document.getElementById("saveBtn");
  const t = translations[currentLang];
  try {
    btn.disabled = true;
    btn.textContent = t.saving;

    const mode = document.querySelector(
      'input[name="conversionMode"]:checked',
    ).value;
    await storage.setConversionMode(mode);

    const token = document.getElementById("mineruToken").value.trim();
    if (token) {
      await storage.setMinerUToken(token);
    }

    const showNotifications = document.getElementById("showNotifications").checked;
    await storage.setShowNotifications(showNotifications);

    logger.info("Settings saved");
    showToast(t.toast_saved, "success");
  } catch (error) {
    logger.error("Failed to save settings:", error);
    showToast("Failed to save: " + error.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t.btn_save;
  }
}

/**
 * 恢复默认设置
 */
async function resetSettings() {
  const t = translations[currentLang];
  if (!confirm(t.confirm_reset)) return;

  try {
    // 恢复默认模式 (FAST)
    await storage.setConversionMode(CONVERSION_MODE.FAST);
    document.querySelector(
      `input[name="conversionMode"][value="${CONVERSION_MODE.FAST}"]`,
    ).checked = true;

    // 清空 Token
    document.getElementById("mineruToken").value = "";
    document.getElementById("tokenStatus").style.display = "none";

    showToast(t.toast_reset, "success");
  } catch (error) {
    logger.error("Failed to reset settings:", error);
    showToast("Failed to reset: " + error.message, "error");
  }
}

/**
 * Toggle Token 可见性
 */
function toggleTokenVisibility() {
  const input = document.getElementById("mineruToken");
  const btn = document.getElementById("toggleTokenBtn");

  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    `;
  } else {
    input.type = "password";
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
  }
}

/**
 * 验证 Token
 */
async function validateToken() {
  const token = document.getElementById("mineruToken").value.trim();
  const statusEl = document.getElementById("tokenStatus");

  if (!token) {
    statusEl.style.display = "none";
    return;
  }

  const t = translations[currentLang];
  
  // 简单的格式验证（实际应该调用 API 验证）
  if (token.length < 10) {
    statusEl.className = "token-status error";
    statusEl.textContent = t.token_invalid;
    return;
  }

  // 这里应该调用 MinerU API 验证 Token
  // 暂时只做格式检查
  statusEl.className = "token-status success";
  statusEl.textContent = t.token_valid;
}

/**
 * 重置统计数据
 */
async function resetStatistics() {
  const t = translations[currentLang];
  if (!confirm(t.confirm_stats_reset)) return;

  try {
    await storage.set("statistics", {
      totalConversions: 0,
      ar5ivSuccess: 0,
      mineruSuccess: 0,
      pdfFallback: 0,
      lastConversionTime: null,
    });

    await loadStatistics();
    showToast(t.toast_stats_reset, "success");
  } catch (error) {
    logger.error("Failed to reset statistics:", error);
    showToast("Failed to reset: " + error.message, "error");
  }
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  const messageEl = toast.querySelector(".toast-message");

  messageEl.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
