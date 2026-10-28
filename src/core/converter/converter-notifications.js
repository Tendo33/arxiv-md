/**
 * batch6：converter 系统通知文案走 locales.js（zh/en），语言跟随扩展设置，规则同 incompleteNotification。
 * 失败通知只给通用文案，原始 error.message 只进日志（调用方负责 logger.error）。
 */
import { translations } from '@config/locales';
import { resolveNotifyLanguage } from './incomplete-notification';

export function converterNotification(key, vars = {}, lang) {
  let code = 'zh';
  try {
    code = resolveNotifyLanguage(lang);
  } catch {
    /* 取不到浏览器语言时用中文，通知不能拖垮转换流程 */
  }
  const t = translations[code] || translations.zh;
  const fill = (s) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));
  return { title: fill(t[`notify_${key}_title`]), message: fill(t[`notify_${key}_body`]) };
}
