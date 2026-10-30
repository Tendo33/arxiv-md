// QA L-01（第二版）：Chromium 里本扩展的 DNR 调用（updateDynamicRules / getDynamicRules / updateSessionRules）
// 可能一直挂起，只有重新载入扩展或重启浏览器才恢复（证据见 dev-log「待决策」）。这里是 DNR 一直不就绪时的兜底：
// 需要 runtime.reload，但不能在用户眼前关掉设置页 / popup：这里只在「没有任何扩展页面开着、
// 也没有别的解析任务在跑」时才重载；否则每 intervalMs 再看一次。SW 被回收也没关系：任务保持 PENDING，
// keepAlive alarm 唤醒后 resume 会再走到这里重新排队。
const PAGE_CONTEXTS = ['TAB', 'POPUP', 'SIDE_PANEL'];
let hooks = [];
let timer = null;

export function _resetDnrReinitForTests() { hooks = []; if (timer) clearTimeout(timer); timer = null; }

/**
 * @param {{isIdle?:()=>boolean, beforeReload?:()=>Promise<void>|void}} opts
 */
export function scheduleReloadWhenIdle(opts = {}, c = globalThis.chrome, { intervalMs = 1000 } = {}) {
  if (!c || !c.runtime || typeof c.runtime.reload !== 'function') return false;
  hooks.push(opts);
  if (timer) return true;
  const tick = async () => {
    timer = null;
    let open = [];
    try { open = c.runtime.getContexts ? await c.runtime.getContexts({ contextTypes: PAGE_CONTEXTS }) : []; } catch { open = []; }
    const busy = hooks.some((h) => typeof h.isIdle === 'function' && !h.isIdle());
    if ((open && open.length) || busy) { timer = setTimeout(tick, intervalMs); return; }
    const hs = hooks; hooks = [];
    for (const h of hs) { try { if (h.beforeReload) await h.beforeReload(); } catch { /* noop */ } }
    c.runtime.reload();
  };
  timer = setTimeout(tick, 0);
  return true;
}
