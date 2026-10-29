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
  const body = failure?.data?.success === false ? failure.data : failure;
  if (body?.errorCode === 'NETWORK_OFFLINE' || failure?.errorCode === 'NETWORK_OFFLINE') return t.content_error_offline;
  // 附录 C10：还没确认数据说明（设置页已打开）
  if (body?.disclosureNeeded) {
    const title = t.pdf_disc_needed_title;
    return /[\u4e00-\u9fff]/.test(title) ? `${title}。${t.pdf_disc_needed_body}` : `${title}. ${t.pdf_disc_needed_body}`;
  }
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

/** 设计验收 30a6e1b #5：C10 拦截（还没确认数据说明）不是失败，走中性提示 */
export function isDisclosureNeeded(failure) {
  const body = failure?.data?.success === false ? failure.data : failure;
  return !!(body?.disclosureNeeded || failure?.disclosureNeeded);
}
