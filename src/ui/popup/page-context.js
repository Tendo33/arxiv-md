// Round 3 C-2：从当前标签页 URL/标题推断 popup 的上下文卡片（纯函数，便于测试）
const PAGE = /^https:\/\/arxiv\.org\/(abs|pdf|html)\/([^?#]+?)(?:\.pdf)?\/?(?:[?#].*)?$/i;

export function pageContext(tab) {
  const url = (tab && tab.url) || '';
  const m = url.match(PAGE);
  if (!m) return { supported: false };
  const kind = m[1].toLowerCase();
  const arxivId = decodeURIComponent(m[2]);
  let title = String((tab && tab.title) || '').trim();
  // abs 页内容脚本会把标题改成论文名；原生标题形如 "[1706.03762] Attention Is All You Need"
  title = title.replace(/^\[[^\]]+\]\s*/, '');
  if (!title || title === arxivId || /^arxiv\.org\//i.test(title) || /\.pdf$/i.test(title)) title = `arXiv:${arxivId}`;
  return { supported: true, kind, arxivId, title, loading: tab.status === 'loading' };
}

/** 最近导出：按时间倒序，默认 3 条 */
export function recentTasks(tasks, limit = 3) {
  return [...(tasks || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
}

/** 当前论文最新的 MinerU 任务（用于 run/ok/err 状态） */
export function taskForPaper(tasks, arxivId) {
  if (!arxivId) return null;
  const base = arxivId.replace(/v\d+$/, '');
  return recentTasks((tasks || []).filter((t) => (t.paperInfo?.arxivId || '').replace(/v\d+$/, '') === base), 1)[0] || null;
}
