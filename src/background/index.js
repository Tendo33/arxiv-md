// Background Service Worker - 处理消息、管理转换任务

import converter from "@core/converter";
import logger from "@utils/logger";
import storage from "@utils/storage";

logger.info("Background service worker initialized");

/**
 * 监听来自 Content Script 或 Popup 的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug("Received message:", message);

  switch (message.type) {
    case "CONVERT_PAPER":
      handleConvertPaper(message.data, sendResponse, sender);
      return true; // 异步响应

    case "DOWNLOAD_PDF":
      handleDownloadPdf(message.data, sendResponse, sender);
      return true; // 异步响应

    case "GET_STATISTICS":
      handleGetStatistics(sendResponse);
      return true;

    case "PING":
      sendResponse({ success: true, message: "pong" });
      return false;

    default:
      logger.warn("Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
      return false;
  }
});

/**
 * 处理论文转换请求
 */
async function handleConvertPaper(paperInfo, sendResponse, sender) {
  logger.info("Handling convert request:", paperInfo);
  const tabId = sender?.tab?.id;

  try {
    const progressCallback = (progress) => {
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, { type: "CONVERSION_PROGRESS", data: progress })
          .catch(() => logger.debug("Failed to send progress update to tab"));
      }
    };

    const result = await converter.convert(paperInfo, progressCallback, tabId);
    sendResponse({ success: true, data: result });
  } catch (error) {
    logger.error("Conversion failed:", error);
    sendResponse({ success: false, error: error.message || "Unknown error" });
  }
}

/**
 * 处理 PDF 下载请求
 */
async function handleDownloadPdf(paperInfo, sendResponse, sender) {
  logger.info("Handling PDF download request:", paperInfo);
  const tabId = sender?.tab?.id;

  try {
    const result = await converter.downloadPdf(paperInfo, tabId);
    sendResponse({ success: true, data: result });
  } catch (error) {
    logger.error("PDF download failed:", error);
    sendResponse({ success: false, error: error.message || "Unknown error" });
  }
}

/**
 * 获取统计数据
 */
async function handleGetStatistics(sendResponse) {
  try {
    const stats = await storage.getStatistics();
    sendResponse({ success: true, data: stats });
  } catch (error) {
    logger.error("Failed to get statistics:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 监听扩展安装/更新
 */
chrome.runtime.onInstalled.addListener((details) => {
  logger.info("Extension installed/updated:", details.reason);

  if (details.reason === "install") {
    // 首次安装，打开欢迎页面
    chrome.tabs.create({
      url: "settings.html?welcome=true",
    });
  } else if (details.reason === "update") {
    logger.info("Updated to version:", chrome.runtime.getManifest().version);
  }
});

/**
 * 监听快捷键
 */
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    logger.debug("Command received:", command);

    if (command === "convert-current-paper") {
      // 向当前 Tab 发送转换指令
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "TRIGGER_CONVERSION",
          });
        }
      });
    }
  });
} else {
  logger.warn("chrome.commands API not available");
}

// 保持 Service Worker 活跃
setInterval(() => logger.debug("Keep alive ping"), 20000);
