// Popup UI 逻辑

import logger from "@utils/logger";

import storage from "@utils/storage";
import { translations } from "@config/locales";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  logger.debug("Popup initialized");

  // 加载语言设置
  const lang = await storage.getLanguage();
  updateLanguage(lang);

  // 绑定设置按钮
  document.getElementById("settingsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
}

function updateLanguage(lang) {
  const t = translations[lang];

  // 更新所有带 data-i18n 属性的元素
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      el.textContent = t[key];
    }
  });
}
