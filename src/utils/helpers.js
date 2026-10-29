import { toDownloadUrl } from '@pdf-core/output/save';
import { REGEX, STORAGE_KEYS } from '@config/constants';

export function extractArxivId(text) {
  if (typeof text !== 'string') return null;
  const normalized = text.trim();
  const match = normalized.match(REGEX.ARXIV_ID);
  if (match) return match[1];
  // Accept bare modern/legacy identifiers and strip version suffix safely.
  const bare = normalized.match(/^((?:\d{4}\.\d{4,5}|[a-z-]+\/[0-9]{7})(?:v\d+)?)$/i);
  return bare ? bare[1] : null;
}

export function sanitizeFilename(filename) {
  const withoutInvalidChars = Array.from(filename, (char) => char.charCodeAt(0) < 32 ? '' : char).join('');
  return withoutInvalidChars
    .replace(/[<>:"/\\|?*]/g, '') // 移除非法字符
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim()
    .substring(0, 200); // 限制长度
}

export function generateFilename(metadata, extension = 'md') {
  const { title, year, arxivId } = metadata;
  let filename = '';

  // 添加标题
  if (title && typeof title === 'string' && title.trim() !== '') {
    filename += sanitizeFilename(title);
  } else {
    filename += `arxiv_${arxivId || 'unknown'}`;
  }

  // 添加年份（如果存在）
  if (year) {
    filename += ` (${year})`;
  }

  // 兜底：如果文件名为空
  if (!filename || filename.trim() === '') {
    filename = `arxiv_${arxivId || Date.now()}`;
  }

  return `${filename.trim()}.${extension}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// batch8 AB7-01：拿到 downloadId 只代表下载开始了，不代表保存成功（404/403/429/500、DNS 失败、用户取消都会先给 id）。
// 这里等到 chrome.downloads.onChanged 报 complete / interrupted 才 resolve / reject：
// - 监听器在调用 download() 之前就挂上，id 未知时先缓存事件；拿到 id 后再 search() 一次，覆盖「监听前已结束」的竞态；
// - 超时（默认 4 分钟）reject，code = DOWNLOAD_TIMEOUT；任何结局都移除监听器、清掉定时器。
// - 审查阻断项：MV3 service worker 30 秒内没有事件 / 扩展 API 调用会被回收，onChanged 不报进度。
//   等待期间每 20 秒调用一次 downloads.search({id})：扩展 API 调用会重置空闲计时器（keepalive），
//   同时兜底漏掉的 onChanged 事件。超时降到 4 分钟，留在 Chrome 单个事件 5 分钟上限之内。
// - interrupted 时 reject 的 Error 带 code = DOWNLOAD_INTERRUPTED 和 downloadError（Chrome 的 InterruptReason，如 SERVER_FORBIDDEN）。
export const DOWNLOAD_TIMEOUT_MS = 4 * 60 * 1000;
export const DOWNLOAD_KEEPALIVE_MS = 20 * 1000;

export function downloadFile(url, filename, { timeoutMs = DOWNLOAD_TIMEOUT_MS, keepaliveMs = DOWNLOAD_KEEPALIVE_MS } = {}) {
  const downloads = chrome.downloads;
  return new Promise((resolve, reject) => {
    let id = null;
    let done = false;
    let timer = null;
    let keepalive = null;
    const early = [];

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (keepalive) clearInterval(keepalive);
      downloads.onChanged.removeListener(onChanged);
      fn(value);
    };
    const interrupted = (reason) => {
      const error = new Error(`Download interrupted: ${reason || 'UNKNOWN'}`);
      error.code = 'DOWNLOAD_INTERRUPTED';
      error.downloadError = reason || 'UNKNOWN';
      return error;
    };
    // item 可以是 onChanged 的 delta（state.current / error.current）或 search() 的 DownloadItem（state / error）
    const settle = (item) => {
      const state = item?.state && typeof item.state === 'object' ? item.state.current : item?.state;
      const err = item?.error && typeof item.error === 'object' ? item.error.current : item?.error;
      if (state === 'complete') finish(resolve, id);
      else if (state === 'interrupted') finish(reject, interrupted(err));
    };
    function onChanged(delta) {
      if (done) return;
      if (id === null) { early.push(delta); return; }
      if (delta.id === id) settle(delta);
    }

    downloads.onChanged.addListener(onChanged);
    timer = setTimeout(() => {
      const error = new Error(`Download timed out after ${timeoutMs} ms`);
      error.code = 'DOWNLOAD_TIMEOUT';
      finish(reject, error);
    }, timeoutMs);

    try {
      downloads.download({ url, filename, saveAs: false }, (downloadId) => {
        if (chrome.runtime.lastError || downloadId === undefined) {
          finish(reject, chrome.runtime.lastError || new Error('Download failed to start'));
          return;
        }
        id = downloadId;
        early.splice(0).filter((d) => d.id === id).forEach(settle);
        if (done) return;
        const poll = () => Promise.resolve(downloads.search({ id })).then((items) => {
          if (!done && items && items[0]) settle(items[0]);
        }, () => { /* search 失败就继续等 onChanged / 超时 */ });
        poll();
        if (!done) keepalive = setInterval(poll, keepaliveMs);
      });
    } catch (error) {
      finish(reject, error);
    }
  });
}

/**
 * batch8 AB7-01：下载失败归类，用于选 zh/en 文案；原始原因只进日志。
 * @returns {'network'|'server'|'canceled'|'file'|'timeout'|'other'}
 */
export function downloadFailureKind(error) {
  if (error?.code === 'DOWNLOAD_TIMEOUT') return 'timeout';
  const reason = error?.code === 'DOWNLOAD_INTERRUPTED' ? String(error.downloadError || '') : '';
  if (/^NETWORK_/.test(reason)) return 'network';
  if (/^SERVER_/.test(reason)) return 'server';
  if (reason === 'USER_CANCELED' || reason === 'USER_SHUTDOWN') return 'canceled';
  if (/^FILE_/.test(reason)) return 'file';
  return 'other';
}

export function downloadBlob(blob, filename) {
  // 验证并清理文件名
  if (!filename || typeof filename !== 'string' || filename.trim() === '') {
    filename = `arxiv_document_${Date.now()}.md`;
  }

  // 清理非法字符
  let cleanFilename =
    filename
      .replace(/[<>:"/\\|?*[\]]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/^\.+/, '')
      .trim() || `arxiv_${Date.now()}.md`;

  if (!cleanFilename.includes('.')) {
    cleanFilename += '.md';
  }

  // 转换为 ASCII 安全格式（Chrome 对非 ASCII 文件名支持不佳）
  const asciiSafeFilename = cleanFilename
    .replace(/[^ -~]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  // R4-10：Chrome SW 用 data URL；有 URL.createObjectURL 的环境（Firefox 后台/页面）用 blob URL
  return toDownloadUrl(blob).then(({ url, revoke, kind }) => {
    chrome.downloads.download(
      {
        url,
        filename: asciiSafeFilename,
        saveAs: false,
        conflictAction: 'uniquify',
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          // 回退：使用保存对话框
          chrome.downloads.download({
            url,
            filename: cleanFilename,
            saveAs: true,
            conflictAction: 'uniquify',
          });
        }
        if (kind === 'blob') setTimeout(revoke, 60000);
        return downloadId;
      },
    );
  });
}

export async function showNotification(title, message, type = 'basic') {
  const showNotifications = await chrome.storage.sync.get(STORAGE_KEYS.SHOW_NOTIFICATIONS);

  if (showNotifications[STORAGE_KEYS.SHOW_NOTIFICATIONS] === false) {
    return;
  }

  chrome.notifications.create({
    type: type,
    iconUrl: 'assets/icon-128.png',
    title: title,
    message: message,
  });
}
