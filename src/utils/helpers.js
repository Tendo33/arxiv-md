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
  console.log('[FILENAME] 📝 生成文件名, 元数据:', metadata);
  
  const { title, authors, year, arxivId } = metadata;
  
  // 格式: (Year) Title - FirstAuthor.ext
  // 使用圆括号而非方括号，避免 Windows 文件名问题
  let filename = '';
  
  if (year) {
    filename += `(${year}) `;
  }
  
  // 确保标题存在且有效
  if (title && typeof title === 'string' && title.trim() !== '') {
    filename += sanitizeFilename(title);
  } else {
    console.warn('[FILENAME] ⚠️ 标题无效，使用 arXiv ID');
    filename += `arxiv_${arxivId || 'unknown'}`;
  }
  
  if (authors && Array.isArray(authors) && authors.length > 0) {
    const firstAuthor = authors[0].split(' ').pop(); // 姓氏
    if (firstAuthor) {
      filename += ` - ${sanitizeFilename(firstAuthor)}`;
    }
  }
  
  // 最终检查：如果文件名仍然为空，使用回退方案
  if (!filename || filename.trim() === '') {
    console.warn('[FILENAME] ⚠️ 文件名生成失败，使用回退方案');
    filename = `arxiv_${arxivId || Date.now()}`;
  }
  
  const finalFilename = `${filename.trim()}.${extension}`;
  console.log('[FILENAME] ✅ 最终文件名:', finalFilename);
  
  return finalFilename;
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
 * 下载 Blob 为文件（Service Worker 兼容版本）
 * @param {Blob} blob - 文件内容
 * @param {string} filename - 文件名
 */
export function downloadBlob(blob, filename) {
  console.log('[DOWNLOAD] 📥 准备下载文件:', filename);
  console.log('[DOWNLOAD] 📦 Blob 大小:', blob.size, 'bytes');
  
  // 验证文件名
  if (!filename || typeof filename !== 'string' || filename.trim() === '') {
    console.error('[DOWNLOAD] ❌ 无效的文件名:', filename);
    filename = `arxiv_document_${Date.now()}.md`; // 回退文件名
    console.log('[DOWNLOAD] 🔄 使用回退文件名:', filename);
  }
  
  // 清理文件名中的非法字符
  // Windows 文件名非法字符: < > : " / \ | ? *
  // 注意：保留扩展名，确保文件名格式正确
  const cleanFilename = filename
    .replace(/[<>:"/\\|?*]/g, '_')  // 替换非法字符为下划线
    .replace(/[\[\]]/g, '')          // 移除方括号
    .replace(/\s+/g, ' ')            // 合并多个空格
    .replace(/^\.+/, '')             // 移除开头的点
    .trim();
  
  console.log('[DOWNLOAD] 🧹 清理后的文件名:', cleanFilename);
  
  // 确保文件名有效且包含扩展名
  let finalFilename = cleanFilename || `arxiv_${Date.now()}.md`;
  
  // 如果没有扩展名，添加 .md
  if (!finalFilename.includes('.')) {
    finalFilename += '.md';
  }
  
  console.log('[DOWNLOAD] 📄 最终文件名:', finalFilename);
  
  // 解决方案：将文件名转换为 ASCII 安全格式
  // Chrome 在处理 Data URL 时，对非 ASCII 字符的文件名支持不好
  // 因此我们需要确保文件名只包含 ASCII 字符
  
  // 先将中文或特殊字符转为拼音或移除
  const asciiSafeFilename = finalFilename
    // 保留 ASCII 字符、数字、空格、点号、连字符、括号、下划线
    .replace(/[^\x00-\x7F]+/g, '_')  // 非 ASCII 字符 → 下划线
    .replace(/_+/g, '_')              // 合并多个下划线
    .replace(/^_+|_+$/g, '');         // 移除首尾下划线
  
  console.log('[DOWNLOAD] 🔤 ASCII 安全文件名:', asciiSafeFilename);
  
  const reader = new FileReader();
  reader.onloadend = () => {
    console.log('[DOWNLOAD] 🚀 开始下载...');
    
    // 使用 chrome.downloads.download API
    // 关键：filename 参数必须是纯 ASCII，否则会被忽略
    chrome.downloads.download(
      {
        url: reader.result, // Data URL
        filename: asciiSafeFilename,  // 使用 ASCII 安全的文件名
        saveAs: false,  // 直接下载，不显示对话框
        conflictAction: 'uniquify'  // 自动处理重名文件
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[DOWNLOAD] ❌ 下载失败:', chrome.runtime.lastError);
          console.error('[DOWNLOAD] 错误详情:', chrome.runtime.lastError.message);
          
          // 如果失败，尝试使用 saveAs: true 和原始文件名
          console.log('[DOWNLOAD] 🔄 尝试使用 saveAs: true 和原始文件名...');
          chrome.downloads.download(
            {
              url: reader.result,
              filename: finalFilename,  // 使用原始文件名
              saveAs: true,  // 显示保存对话框
              conflictAction: 'uniquify'
            },
            (retryId) => {
              if (chrome.runtime.lastError) {
                console.error('[DOWNLOAD] ❌ 重试也失败:', chrome.runtime.lastError);
              } else {
                console.log('[DOWNLOAD] ✅ 重试成功! ID:', retryId);
              }
            }
          );
        } else {
          console.log('[DOWNLOAD] ✅ 下载成功!');
          console.log('[DOWNLOAD] 下载 ID:', downloadId);
          console.log('[DOWNLOAD] ASCII 文件名:', asciiSafeFilename);
          console.log('[DOWNLOAD] 原始文件名:', finalFilename);
          
          // 监听下载完成事件，显示实际保存的文件名
          const listener = (delta) => {
            if (delta.id === downloadId && delta.filename) {
              console.log('[DOWNLOAD] 📂 实际保存文件名:', delta.filename.current);
              chrome.downloads.onChanged.removeListener(listener);
            }
          };
          chrome.downloads.onChanged.addListener(listener);
        }
      }
    );
  };
  
  reader.onerror = () => {
    console.error('[DOWNLOAD] ❌ FileReader 读取失败:', reader.error);
  };
  
  // 读取 Blob 为 Data URL
  reader.readAsDataURL(blob);
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

