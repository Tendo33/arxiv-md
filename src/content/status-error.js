import logger from '@utils/logger';

/**
 * AB6-03：页面状态卡只显示本地化的通用文案；后台/异常的原始英文报错（如 "Invalid filename"）只写日志。
 * @param {object|Error|null} failure 后台返回的失败体或异常
 * @param {object} t 当前语言文案
 * @param {string} context 日志前缀
 * @param {{download?: boolean}} [opts] download: 这是一次 PDF 下载（页面 PDF 按钮），没有类别时也用「下载失败」
 * @returns {string} 状态卡文案
 */
export function statusCardErrorText(failure, t, context = 'Conversion failed', { download: fallback = false } = {}) {
  // 审查 P3-c：runtime.reload（设置页「重新初始化」/ L-01 自动重载）后，已打开的 arXiv 页面里旧内容脚本失效，
  // chrome.runtime.sendMessage 会同步抛「Extension context invalidated」，走不到回调里的 lastError 分支。
  // 没有 scripting 权限，不能重新注入，所以复用现有文案提示用户刷新页面。
  if (isContextInvalidated(failure) && t?.content_error_extension_reloaded) {
    logger.warn(`${context}: extension context invalidated`);
    return t.content_error_extension_reloaded;
  }
  const body = failure?.data?.success === false ? failure.data : failure;
  if (body?.errorCode === 'NETWORK_OFFLINE' || failure?.errorCode === 'NETWORK_OFFLINE') return t.content_error_offline;
  const raw = body?.error || failure?.error || failure?.data?.error || failure?.message;
  if (raw) logger.error(`${context}:`, raw);
  // batch8 AB7-01/02：PDF 下载失败时状态卡和通知用同一类文案（下载失败 / 已取消 / …），不再写「转换失败」
  const kind = body?.downloadFailure;
  if (kind && t[`content_error_download_${kind}`]) return t[`content_error_download_${kind}`];
  if (kind || fallback) return t.content_error_download_other || t.content_error_generic;
  return t.content_error_generic;
}

/** batch9 M3：下载被取消（用户取消 / 已从下载列表移除）不算失败，状态卡用「已取消」 */
export function isCanceledDownload(failure) {
  const body = failure?.data?.success === false ? failure.data : failure;
  const kind = body?.downloadFailure;
  return kind === 'canceled' || kind === 'removed';
}

/** 扩展重载后旧内容脚本调用扩展 API 抛出的异常（Chrome："Extension context invalidated."） */
export function isContextInvalidated(failure) {
  const msg = failure instanceof Error ? failure.message : '';
  return /extension context invalidated/i.test(msg || '');
}
