/**
 * PDF 解析任务的系统通知文案。语言跟随扩展设置（与 AF3 不完整通知相同的规则），不跟随浏览器语言。
 * 失败时按错误码 / reason 选文案（复用 err_* / err_reason_*）；认不出的一律用通用失败文案，
 * 不把 e.message 原文给用户看（原文只进 console）。
 */
import { translations } from '@config/locales';
import { resolveNotifyLanguage } from '@core/converter/incomplete-notification';

const fill = (s, vars) => s.replace(/\{(provider|host)\}/g, (_, k) => vars[k] || '');

export function failureText(err, label, lang) {
  const t = translations[resolveNotifyLanguage(lang)];
  const vars = { provider: label, host: (err && err.host) || '' };
  const reasonMsg = err && err.reason && t[`err_reason_${err.reason}`];
  if (reasonMsg) return fill(reasonMsg, vars);
  // PROVIDER_FAILED 的 {reason} 是原始信息，不展示；PERMISSION_MISSING 没有 host 时也用通用文案
  const code = err && err.code;
  if (code && code !== 'PROVIDER_FAILED' && t[`err_${code}`] && !(code === 'PERMISSION_MISSING' && !vars.host)) {
    return fill(t[`err_${code}`], vars);
  }
  return fill(t.notify_task_failed_generic, vars);
}

export function taskNotificationText(task, status, detail, label, lang) {
  const t = translations[resolveNotifyLanguage(lang)];
  const title = (task.paperInfo && (task.paperInfo.title || task.paperInfo.arxivId)) || '';
  const short = title.length > 40 ? title.substring(0, 40) + '…' : title;
  const v = (s) => s.replace(/\{provider\}/g, label);
  if (status === 'consent') {
    return { title: v(t.notify_task_consent_title), message: `${short}\n\n${v(t.notify_task_consent_body)}` };
  }
  if (status === 'disclosure') {
    // 审查 30a6e1b P2：中性提示，共用标题「需要先确认数据说明」
    return { title: t.pdf_disc_needed_title, message: `${short}\n\n${t.task_disc_needed_body}` };
  }
  if (status === 'completed') {
    return { title: v(t.notify_task_done_title), message: `${short}\n\n${t.notify_task_done_body}`, button: t.notify_task_view };
  }
  return { title: v(t.notify_task_failed_title), message: `${short}\n\n${failureText(detail, label, lang)}` };
}
