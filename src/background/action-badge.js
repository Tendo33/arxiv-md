/**
 * Round 2 审查：/html/ 和 /pdf/ 页没有页内进度 UI，快捷键转换的进度/结果用工具栏徽标反馈。
 * chrome.action.setBadgeText / setBadgeBackgroundColor 不需要额外权限。
 */
export const BADGE = {
  running: { text: '…', color: '#1d4ed8' },
  success: { text: '✓', color: '#15803d' },
  error: { text: '!', color: '#b91c1c' },
};
export const BADGE_CLEAR_MS = { running: 120000, success: 4000, error: 6000 };

export function createActionBadge(actionApi, timers = { setTimeout, clearTimeout }) {
  const pending = new Map(); // tabId -> clear timer
  const shortcutTabs = new Set();

  const clear = (tabId) => {
    if (pending.has(tabId)) timers.clearTimeout(pending.get(tabId));
    pending.delete(tabId);
    try {
      actionApi.setBadgeText({ tabId, text: '' });
    } catch (_) { /* tab 已关闭 */ }
  };

  const show = (tabId, state) => {
    const badge = BADGE[state];
    if (!badge || tabId == null || !actionApi) return;
    if (pending.has(tabId)) timers.clearTimeout(pending.get(tabId));
    try {
      actionApi.setBadgeBackgroundColor({ tabId, color: badge.color });
      actionApi.setBadgeText({ tabId, text: badge.text });
    } catch (_) { return; }
    pending.set(tabId, timers.setTimeout(() => {
      pending.delete(tabId);
      if (state !== 'running') shortcutTabs.delete(tabId);
      clear(tabId);
    }, BADGE_CLEAR_MS[state]));
  };

  return {
    /** 快捷键已把 TRIGGER_CONVERSION 发到这个标签页 */
    shortcutStarted(tabId) {
      shortcutTabs.add(tabId);
      show(tabId, 'running');
    },
    /** 消息没送到（非 arXiv 页） */
    shortcutUndelivered(tabId) {
      shortcutTabs.delete(tabId);
      clear(tabId);
    },
    /** 转换结束；只有快捷键发起的转换才显示结果徽标 */
    finish(tabId, ok) {
      if (!shortcutTabs.has(tabId)) return false;
      shortcutTabs.delete(tabId);
      show(tabId, ok ? 'success' : 'error');
      return true;
    },
    isTracking: (tabId) => shortcutTabs.has(tabId),
  };
}
