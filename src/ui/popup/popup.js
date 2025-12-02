// Popup UI 逻辑 - 简化版，只提供设置入口

import logger from "@utils/logger";

document.addEventListener("DOMContentLoaded", init);

/**
 * 初始化
 */
function init() {
  logger.debug("Popup initialized");

  // 绑定设置按钮
  document.getElementById("settingsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
}
