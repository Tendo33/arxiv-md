import logger from '@utils/logger';

/**
 * AB6-03：页面状态卡只显示本地化的通用文案；后台/异常的原始英文报错（如 "Invalid filename"）只写日志。
 * @param {object|Error|null} failure 后台返回的失败体或异常
 * @param {object} t 当前语言文案
 * @param {string} context 日志前缀
 * @returns {string} 状态卡文案
 */
export function statusCardErrorText(failure, t, context = 'Conversion failed') {
  if (failure?.errorCode === 'NETWORK_OFFLINE') return t.content_error_offline;
  const raw = failure?.error || failure?.data?.error || failure?.message;
  if (raw) logger.error(`${context}:`, raw);
  return t.content_error_generic;
}
