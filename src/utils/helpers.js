// {{RIPER-7 Action}}
// Role: LD | Task_ID: #1 | Time: 2025-12-01T21:18:25+08:00
// Logic: 通用工具函数集合
// Principle: SOLID-S (Single Responsibility - 每个函数职责单一)

import { REGEX } from '@config/constants';

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
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // 移除非法字符
    .replace(/\s+/g, ' ')                  // 合并多个空格
    .trim()
    .substring(0, 200);                    // 限制长度
}

/**
 * 生成文件名
 * @param {Object} metadata - 论文元数据
 * @param {string} extension - 文件扩展名
 * @returns {string} 文件名
 */
export function generateFilename(metadata, extension = 'md') {
  const { title, authors, year, arxivId } = metadata;
  
  // 格式: [Year] Title - FirstAuthor.ext
  let filename = '';
  
  if (year) {
    filename += `[${year}] `;
  }
  
  filename += sanitizeFilename(title);
  
  if (authors && authors.length > 0) {
    const firstAuthor = authors[0].split(' ').pop(); // 姓氏
    filename += ` - ${firstAuthor}`;
  }
  
  if (!filename) {
    filename = `arxiv_${arxivId}`;
  }
  
  return `${filename}.${extension}`;
}

/**
 * 延迟执行
 * @param {number} ms - 毫秒数
 * @returns {Promise}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查 URL 是否可访问
 * @param {string} url - 要检查的 URL
 * @returns {Promise<boolean>}
 */
export async function checkUrlExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
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
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

/**
 * 下载 Blob 为文件
 * @param {Blob} blob - 文件内容
 * @param {string} filename - 文件名
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  chrome.downloads.download(
    {
      url: url,
      filename: filename,
      saveAs: false
    },
    () => {
      // 下载完成后释放 Object URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  );
}

/**
 * 格式化字节数
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
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
 * 创建通知
 * @param {string} title - 标题
 * @param {string} message - 消息
 * @param {string} type - 类型 ('basic', 'image', 'list', 'progress')
 */
export function showNotification(title, message, type = 'basic') {
  chrome.notifications.create({
    type: type,
    iconUrl: 'assets/icon-128.png',
    title: title,
    message: message
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
      console.error('Async error:', error);
      throw error;
    }
  };
}

