/**
 * Round 2 审查：/html/ 和 /pdf/ 页没有页内进度 UI，快捷键转换的进度/结果用工具栏徽标反馈。
 * chrome.action.setBadgeText / setBadgeBackgroundColor 不需要额外权限。
 */
export const BADGE = {
  running: { text: '…', color: '#1d4ed8', textColor: '#ffffff' },
  success: { text: '✓', color: '#15803d', textColor: '#ffffff' },
  error: { text: '!', color: '#b91c1c', textColor: '#ffffff' },
  // AF3-01：已下载但可能不完整。设计验收：亮琥珀底 + 深字（8.49:1），与其余三态的深底白字明暗相反
  warning: { text: '⚠', color: '#f59e0b', textColor: '#1f1300' },
};
export const BADGE_CLEAR_MS = { running: 120000, success: 4000, error: 6000, warning: 6000 };

// A2-01：Chrome 里 setTimeout/clearTimeout 脱离 globalThis 调用会抛 "Illegal invocation"，
// 所以默认实现用箭头函数包一层，调用时 this 仍是全局对象。
export const defaultTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

// setBadgeText 等在 MV3 返回 Promise，标签页已关闭时会 reject；同步抛错也一并吞掉
const safeCall = (fn) => {
  try {
    const r = fn();
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch (_) { /* tab 已关闭 */ }
};

export function createActionBadge(actionApi, timers = defaultTimers) {
  const pending = new Map(); // tabId -> clear timer
  const shortcutTabs = new Set();

  const clear = (tabId) => {
    try {
      if (pending.has(tabId)) timers.clearTimeout(pending.get(tabId));
    } catch (_) { /* 计时器异常不影响清除徽标 */ }
    pending.delete(tabId);
    if (actionApi) safeCall(() => actionApi.setBadgeText({ tabId, text: '' }));
  };

  const show = (tabId, state) => {
    const badge = BADGE[state];
    if (!badge || tabId == null || !actionApi) return;
    try {
      if (pending.has(tabId)) timers.clearTimeout(pending.get(tabId));
      pending.delete(tabId);
      safeCall(() => actionApi.setBadgeBackgroundColor({ tabId, color: badge.color }));
      // 设计验收：四态都显式设文字色，不让 Chrome 按平台自动选；旧版 Chrome 没有这个 API
      if (typeof actionApi.setBadgeTextColor === 'function') {
        safeCall(() => actionApi.setBadgeTextColor({ tabId, color: badge.textColor }));
      }
      safeCall(() => actionApi.setBadgeText({ tabId, text: badge.text }));
      pending.set(tabId, timers.setTimeout(() => {
        pending.delete(tabId);
        if (state !== 'running') shortcutTabs.delete(tabId);
        clear(tabId);
      }, BADGE_CLEAR_MS[state]));
    } catch (_) { /* 徽标只是反馈，出错不能影响转换 */ }
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
      // ok 也可以直接传状态名（AF3-01：'warning'）
      show(tabId, typeof ok === 'string' && BADGE[ok] ? ok : (ok ? 'success' : 'error'));
      return true;
    },
    /**
     * H-01（管理员定）：重复的 MinerU 任务——清掉「…」但继续跟踪，
     * 等 content 上报用户取消（清除）或强制提交失败（「!」）。
     */
    hold(tabId) {
      if (!shortcutTabs.has(tabId)) return false;
      clear(tabId);
      return true;
    },
    /** 不显示结果、直接清除并停止跟踪（用户取消重复任务等） */
    dismiss(tabId) {
      if (!shortcutTabs.has(tabId)) return false;
      shortcutTabs.delete(tabId);
      clear(tabId);
      return true;
    },
    /** 没有转换可跟踪、但要让用户看到失败（右键链接导出失败/超时），复用 "!" 徽标 */
    fail(tabId) {
      shortcutTabs.delete(tabId);
      show(tabId, 'error');
    },
    isTracking: (tabId) => shortcutTabs.has(tabId),
    /** 页面跳转/刷新：清掉残留徽标（含 service worker 被回收后丢了计时器的情况，复审建议 3） */
    tabLoading(tabId) {
      shortcutTabs.delete(tabId);
      clear(tabId);
    },
    /**
     * Round 3：service worker 启动（含被回收后重启）或浏览器启动时，内存里的计时器已经丢了，
     * 把所有标签页上可能残留的徽标清掉。tabs.query 不带 url 过滤时不需要 tabs 权限。
     */
    async sweep(tabsApi) {
      if (!actionApi || !tabsApi || typeof tabsApi.query !== 'function') return 0;
      let tabs = [];
      try { tabs = (await tabsApi.query({})) || []; } catch (_) { return 0; }
      for (const t of tabs) if (t && t.id != null && !shortcutTabs.has(t.id)) clear(t.id);
      return tabs.length;
    },
  };
}

/**
 * content 侧提前结束的失败（断网、扩展刚重载、元数据失败等）不会发 CONVERT_PAPER，
 * 由 showError 上报 SHORTCUT_RESULT，后台据此把「…」换成「!」（复审建议 1）。
 */
export function handleShortcutResult(badge, message, sender, runtimeId) {
  if (!sender || sender.id !== runtimeId || !sender.tab || sender.tab.id == null) return false;
  if (message.clear) return badge.dismiss(sender.tab.id);
  return badge.finish(sender.tab.id, !!message.ok);
}

/**
 * H-01：快捷键转换的徽标结果。{ success:false }（断网、下载失败等）显示「!」。
 * duplicate 不走这里：background 调 hold() 直接清除徽标（管理员定，不显示「✓」）。
 */
export function conversionSucceeded(result) {
  if (!result || typeof result !== 'object' || result.duplicate) return false;
  return result.success !== false;
}

/** AF3-01：转换结果对应的徽标状态；成功但可能不完整时是 'warning'，不显示 ✓ */
export function conversionBadgeState(result) {
  if (!conversionSucceeded(result)) return 'error';
  return result.incomplete ? 'warning' : 'success';
}
