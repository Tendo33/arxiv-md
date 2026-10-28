/**
 * AF3：「导出可能不完整」系统通知。语言跟随扩展设置（storage 的 language，与 popup、页面条一致），
 * 不跟随浏览器 UI 语言；未设置或不是 zh/en（如「自动」）时按 browserDefaultLanguage 的默认规则。
 * 文案在 locales.js 的 notify_incomplete_*，与 _locales 里同名 key 保持一致（由测试保证）。
 * 先写缺了多少，再写文件名；标题 ⚠ 为 U+26A0，不带 U+FE0F。
 */
import { translations } from '@config/locales';
import { browserDefaultLanguage } from '@utils/storage';

export function resolveNotifyLanguage(lang) {
  return lang === 'zh' || lang === 'en' ? lang : browserDefaultLanguage();
}

export function incompleteNotification({ expected, actual, filename }, lang) {
  const t = translations[resolveNotifyLanguage(lang)];
  return {
    title: t.notify_incomplete_title,
    message: t.notify_incomplete_body
      .replace('{expected}', String(expected))
      .replace('{actual}', String(actual))
      .replace('{filename}', String(filename || '')),
  };
}
