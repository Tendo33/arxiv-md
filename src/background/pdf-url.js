// 任务要发给解析后端的 PDF 地址（没有显式 pdfUrl 时按 arXiv ID 拼）
export function pdfUrlOf(task) {
  const p = task.paperInfo || {};
  return p.pdfUrl || `https://arxiv.org/pdf/${p.arxivId}.pdf`;
}
