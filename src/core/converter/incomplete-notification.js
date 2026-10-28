/**
 * AF3 设计验收：「导出可能不完整」系统通知走 _locales（notify_incomplete_title / notify_incomplete_body），
 * 先写缺了多少，再写文件名。标题里的 ⚠ 是 U+26A0（不带 U+FE0F），与徽标、页面条一致。
 * chrome.i18n 不可用（单测、极端环境）时退回中文。
 */
const FALLBACK = {
  title: '\u26a0 导出可能不完整',
  body: '约 $1 个标题只导出了 $2 个，请核对。\n已保存：$3',
};

export function incompleteNotification({ expected, actual, filename }, i18n = globalThis.chrome && globalThis.chrome.i18n) {
  const subs = [String(expected), String(actual), String(filename || '')];
  const get = (key) => {
    try {
      return (i18n && typeof i18n.getMessage === 'function' && i18n.getMessage(key, subs)) || '';
    } catch (_) {
      return '';
    }
  };
  const title = get('notify_incomplete_title') || FALLBACK.title;
  const message = get('notify_incomplete_body')
    || FALLBACK.body.replace('$1', subs[0]).replace('$2', subs[1]).replace('$3', subs[2]);
  return { title, message };
}
