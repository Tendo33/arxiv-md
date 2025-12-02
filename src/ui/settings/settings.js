// Settings 页面逻辑 - 配置管理、Token 验证、统计展示

import storage from "@utils/storage";
import { CONVERSION_MODE } from "@config/constants";
import logger from "@utils/logger";

// 多语言翻译
const translations = {
  en: {
    welcome_title: "🎉 Welcome to arXiv to Markdown!",
    welcome_desc: "Convert arXiv papers to Markdown with one click. Fast conversion with ar5iv, automatic PDF fallback.",
    mode_title: "Conversion Mode",
    mode_desc: "Choose your default conversion strategy",
    mode_standard_title: "Standard Mode",
    mode_standard_desc: "ar5iv + local conversion, PDF fallback",
    mode_recommended: "Recommended",
    mode_mineru_title: "MinerU Mode",
    mode_mineru_desc: "Always use MinerU (manual, requires token)",
    mode_requires_token: "Requires Token",
    mineru_title: "MinerU API Configuration",
    mineru_desc: "Optional: For manual MinerU mode only",
    mineru_token_label: "API Token",
    mineru_token_placeholder: "Enter your MinerU API Token",
    mineru_visit: "Visit mineru.net",
    mineru_hint: "to register and get your token",
    mineru_about: "💡 About MinerU",
    mineru_feature1: "✅ Perfect LaTeX formula handling",
    mineru_feature2: "✅ High-precision table recognition",
    mineru_feature3: "✅ Automatic image extraction",
    mineru_feature4: "✅ Works with all PDFs",
    mineru_quota: "Free tier: 2000 pages/day",
    advanced_title: "Advanced Options",
    advanced_auto: "Auto-convert (show prompt on paper page load)",
    advanced_metadata: "Include metadata in Markdown (title, authors, ID, etc.)",
    advanced_notifications: "Show desktop notifications",
    stats_title: "Usage Statistics",
    stats_total: "Total Conversions",
    stats_ar5iv: "ar5iv Success",
    stats_mineru: "MinerU Success",
    stats_pdf: "PDF Fallback",
    stats_reset: "Reset Statistics",
    btn_save: "Save Settings",
    btn_reset: "Reset to Default",
    toast_saved: "✅ Settings saved successfully",
    toast_reset: "✅ Settings reset to default",
    toast_stats_reset: "✅ Statistics reset successfully",
    confirm_reset: "Are you sure you want to reset to default settings?",
    confirm_stats_reset: "Are you sure you want to reset all statistics?",
    token_invalid: "❌ Token format invalid (too short)",
    token_valid: "✅ Token format looks good (test after saving)",
    saving: "Saving...",
  },
  zh: {
    welcome_title: "🎉 欢迎使用 arXiv to Markdown！",
    welcome_desc: "一键将 arXiv 论文转换为 Markdown，支持 ar5iv 快速转换和 PDF 自动降级。",
    mode_title: "转换模式",
    mode_desc: "选择论文转换的默认策略",
    mode_standard_title: "标准模式",
    mode_standard_desc: "ar5iv + 本地转换，失败时下载 PDF",
    mode_recommended: "推荐",
    mode_mineru_title: "MinerU 模式",
    mode_mineru_desc: "始终使用 MinerU（手动模式，需要 Token）",
    mode_requires_token: "需要 Token",
    mineru_title: "MinerU API 配置",
    mineru_desc: "可选：仅用于手动 MinerU 模式",
    mineru_token_label: "API Token",
    mineru_token_placeholder: "输入您的 MinerU API Token",
    mineru_visit: "访问 mineru.net",
    mineru_hint: "注册账号并获取 Token",
    mineru_about: "💡 关于 MinerU",
    mineru_feature1: "✅ 完美处理复杂 LaTeX 公式",
    mineru_feature2: "✅ 高精度表格识别",
    mineru_feature3: "✅ 图片自动提取",
    mineru_feature4: "✅ 支持所有 PDF",
    mineru_quota: "免费账号：每天 2000 页解析额度",
    advanced_title: "高级选项",
    advanced_auto: "自动转换（进入论文页面自动弹出转换提示）",
    advanced_metadata: "在 Markdown 中包含元数据（标题、作者、ID 等）",
    advanced_notifications: "显示桌面通知",
    stats_title: "使用统计",
    stats_total: "总转换次数",
    stats_ar5iv: "ar5iv 成功",
    stats_mineru: "MinerU 成功",
    stats_pdf: "PDF 兜底",
    stats_reset: "重置统计数据",
    btn_save: "保存设置",
    btn_reset: "恢复默认",
    toast_saved: "✅ 设置已保存",
    toast_reset: "✅ 已恢复默认设置",
    toast_stats_reset: "✅ 统计数据已重置",
    confirm_reset: "确定要恢复默认设置吗？",
    confirm_stats_reset: "确定要重置所有统计数据吗？",
    token_invalid: "❌ Token 格式无效（长度过短）",
    token_valid: "✅ Token 格式正确（建议保存后测试）",
    saving: "保存中...",
  }
};

let currentLang = "en";

document.addEventListener("DOMContentLoaded", init);

/**
 * 初始化
 */
async function init() {
  logger.debug("Settings page initialized");

  // 加载语言设置
  const savedLang = localStorage.getItem("arxiv-md-lang") || "en";
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
  localStorage.setItem("arxiv-md-lang", lang);
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
