import logger from '@utils/logger';

/**
 * 处理文本文件下载（使用 <a> download 属性）
 */
export function handleFileDownload(data, sendResponse) {
  try {
    const blob = new Blob([data.content], {
      type: data.mimeType || 'text/plain',
    });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);

    sendResponse({ success: true });
  } catch (error) {
    logger.error('Download failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理 Blob 文件下载（从 base64 数据）
 */
export function handleBlobDownload(data, sendResponse) {
  try {
    // 将 base64 转换为 Blob
    const binaryString = atob(data.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: data.mimeType || 'application/octet-stream' });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);

    sendResponse({ success: true });
  } catch (error) {
    logger.error('Blob download failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}
