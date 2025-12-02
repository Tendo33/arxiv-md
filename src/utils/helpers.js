// 通用工具函数集合

import { REGEX } from "@config/constants";

/**
 * 从 URL 或文本中提取 arXiv ID
 * @param {string} text - 包含 arXiv ID 的文本或 URL
 * @returns {string|null} arXiv ID 或 null
 */
export function extractArxivId(text) {
  const match = text.match(REGEX.ARXIV_ID);
  return match ? match[1] : null;
}

/**
 * 清理文件名，移除非法字符
 * @param {string} filename - 原始文件名
 * @returns {string} 清理后的文件名
 */
export function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // 移除非法字符
    .replace(/\s+/g, " ") // 合并多个空格
    .trim()
    .substring(0, 200); // 限制长度
}

/**
 * 生成文件名
 * 格式: title(年份).ext
 */
export function generateFilename(metadata, extension = "md") {
  const { title, year, arxivId } = metadata;
  let filename = "";

  // 添加标题
  if (title && typeof title === "string" && title.trim() !== "") {
    filename += sanitizeFilename(title);
  } else {
    filename += `arxiv_${arxivId || "unknown"}`;
  }

  // 添加年份（如果存在）
  if (year) {
    filename += `(${year})`;
  }

  // 兜底：如果文件名为空
  if (!filename || filename.trim() === "") {
    filename = `arxiv_${arxivId || Date.now()}`;
  }

  return `${filename.trim()}.${extension}`;
}

/**
 * 延迟执行
 * @param {number} ms - 毫秒数
 * @returns {Promise}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 检查 URL 是否可访问
 * @param {string} url - 要检查的 URL
 * @returns {Promise<boolean>}
 */
export async function checkUrlExists(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 下载文件（使用 Chrome Downloads API）
 * @param {string} url - 文件 URL
 * @param {string} filename - 保存的文件名
 * @returns {Promise<number>} 下载 ID
 */
export function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      },
    );
  });
}

/**
 * 下载 Blob 为文件（Service Worker 兼容版本）
 */
export function downloadBlob(blob, filename) {
  // 验证并清理文件名
  if (!filename || typeof filename !== "string" || filename.trim() === "") {
    filename = `arxiv_document_${Date.now()}.md`;
  }

  // 清理非法字符
  let cleanFilename =
    filename
      .replace(/[<>:"/\\|?*\[\]]/g, "_")
      .replace(/\s+/g, " ")
      .replace(/^\.+/, "")
      .trim() || `arxiv_${Date.now()}.md`;

  if (!cleanFilename.includes(".")) {
    cleanFilename += ".md";
  }

  // 转换为 ASCII 安全格式（Chrome 对非 ASCII 文件名支持不佳）
  const asciiSafeFilename = cleanFilename
    .replace(/[^\x00-\x7F]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const reader = new FileReader();
  reader.onloadend = () => {
    chrome.downloads.download(
      {
        url: reader.result,
        filename: asciiSafeFilename,
        saveAs: false,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          // 回退：使用保存对话框
          chrome.downloads.download({
            url: reader.result,
            filename: cleanFilename,
            saveAs: true,
            conflictAction: "uniquify",
          });
        }
      },
    );
  };
  reader.readAsDataURL(blob);
}

/**
 * 格式化字节数
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化时间（毫秒转秒）
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的字符串
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}

/**
 * 创建通知（根据用户设置决定是否显示）
 * @param {string} title - 标题
 * @param {string} message - 消息
 * @param {string} type - 类型 ('basic', 'image', 'list', 'progress')
 */
export async function showNotification(title, message, type = "basic") {
  // 检查用户是否启用了桌面通知
  const showNotifications = await chrome.storage.sync.get("showNotifications");
  
  // 默认启用通知（向后兼容）
  if (showNotifications.showNotifications === false) {
    return; // 用户禁用了通知，直接返回
  }
  
  chrome.notifications.create({
    type: type,
    iconUrl: "assets/icon-128.png",
    title: title,
    message: message,
  });
}

/**
 * 错误处理包装器
 * @param {Function} fn - 异步函数
 * @returns {Function} 包装后的函数
 */
export function asyncErrorHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error("Async error:", error);
      throw error;
    }
  };
}
