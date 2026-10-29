// 审查 P1-1：默认只把开放获取（OA）的 PDF 发给第三方解析；其他 PDF 先由用户确认再发送。
// OA 判定（P1-A 方案 2，Simon 决定）：arXiv 上的论文一律视为 OA，arXiv 托管的 PDF 直接解析、不弹确认，
// 不逐篇检查 license。PRIVACY.md「Open access」段是对应的政策文字（发布前由 Simon 审阅）。
// 其他来源、地址解析失败或缺字段一律按非 OA 处理（拿不准就按非 OA）。
import { pdfUrlOf } from './pdf-url';

const ARXIV_PDF_HOSTS = new Set(['arxiv.org', 'export.arxiv.org']);

/** @returns {boolean} 只有能确定是 arXiv 托管的 PDF 时才返回 true */
export function isOpenAccessPdf(task) {
  try {
    if (!task || !task.paperInfo) return false;
    const u = new URL(pdfUrlOf(task));
    if (u.protocol !== 'https:' || !ARXIV_PDF_HOSTS.has(u.hostname)) return false;
    return /^\/pdf\/(\d{4}\.\d{4,5}|[a-z-]+(\.[A-Z]{2})?\/\d{7})(v\d+)?(\.pdf)?$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** 任务可以发送：OA，或用户已经对这个任务确认过上传 */
export function uploadAllowed(task) {
  return task && (task.uploadConsent === true || isOpenAccessPdf(task));
}
