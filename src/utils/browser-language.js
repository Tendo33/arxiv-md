/** 浏览器界面语言 → 扩展语言（zh* → 中文，其余英文）。release-polish AB8-04 统一兜底规则 */
export function browserDefaultLanguage(
  uiLang = (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage)
    ? chrome.i18n.getUILanguage()
    : (typeof navigator !== 'undefined' ? navigator.language : ''),
) {
  return /^zh\b/i.test(uiLang || '') ? 'zh' : 'en';
}
