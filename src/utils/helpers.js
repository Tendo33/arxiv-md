import { REGEX } from "@config/constants";

export function extractArxivId(text) {
  const match = text.match(REGEX.ARXIV_ID);
  return match ? match[1] : null;
}

export function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // 移除非法字符
    .replace(/\s+/g, " ") // 合并多个空格
    .trim()
    .substring(0, 200); // 限制长度
}

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

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
