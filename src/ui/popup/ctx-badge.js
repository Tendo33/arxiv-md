/**
 * 页面卡片徽标：返回 [样式类, 文案]。
 * 设计复核 S1：没有 Key 时点「PDF 解析」不算失败，用中性的 idle 样式和「需要 Key / Key needed」。
 */
export function ctxBadgeState({ busy, loading, state, kind }, tr) {
  if (busy) return ['run', tr.popup_badge_run];
  if (loading) return ['dis', tr.popup_badge_dis];
  if (state === 'ok') return ['ok', tr.popup_badge_ok];
  // 设计验收 B1：PDF 解析任务已提交但还没完成，用等待样式
  if (state === 'submitted') return ['wait', tr.content_progress_submitted];
  if (state === 'err') return ['err', tr.popup_badge_err];
  if (state === 'needkey') return ['idle', tr.popup_badge_needkey];
  return ['idle', tr[`popup_badge_${kind}`]];
}
