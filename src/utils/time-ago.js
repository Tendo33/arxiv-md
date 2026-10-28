/**
 * 相对时间：用 Intl.RelativeTimeFormat 处理单复数（设计验收必须改 2：不再出现「1 mins ago」）
 * @param {number} timestamp
 * @param {'zh'|'en'} lang
 * @param {string} justNow 不足 1 分钟时的文案
 */
export const TIME_AGO_PLACEHOLDER = '—';

export function formatTimeAgo(timestamp, lang, justNow, now = Date.now()) {
  // A2-02：缺 createdAt / 存储数据损坏时不抛 RangeError，显示占位
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || !Number.isFinite(now)) {
    return TIME_AGO_PLACEHOLDER;
  }
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return justNow;
  const rtf = new Intl.RelativeTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.floor(hours / 24), 'day');
}
