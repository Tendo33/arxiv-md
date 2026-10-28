// 审查 P1-1：非 OA PDF 先弹确认框，用户点「继续上传」后才让后台发送；取消则什么都不发
import { providerLabel } from '@config/pdf-providers';

export async function confirmUploadFlow(taskId, providerId, { showConfirm, sendMessage, tr }) {
  const msg = tr.popup_confirm_upload.replace('{provider}', providerLabel(providerId));
  if (!(await showConfirm(msg, { okLabel: tr.popup_btn_upload, tone: 'brand' }))) return false;
  const res = await sendMessage({ type: 'CONFIRM_PDF_UPLOAD', taskId });
  return !!(res && res.success);
}
