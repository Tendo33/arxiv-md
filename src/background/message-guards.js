// 后台消息的防御性校验，单独成模块便于测试

const ARXIV_ID = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i;

export function isValidArxivId(id) {
  return typeof id === 'string' && ARXIV_ID.test(id);
}

/**
 * 只接受本扩展自己的消息。优先看 sender.url（真正发消息的 frame），tab.url 仅兜底：
 * - chrome-extension://<本扩展 id>/ 页面（popup、以标签页打开的 settings）放行；
 * - 其余必须是 https://arxiv.org（content script 只注入在 arxiv.org）。
 */
export function isTrustedArxivSender(sender, runtimeId) {
  if (!sender || !runtimeId || sender.id !== runtimeId) return false;
  const url = sender.url || (sender.tab && sender.tab.url) || '';
  if (!url) return !sender.tab; // 无 url 且非标签页：扩展自身上下文
  if (url.startsWith(`chrome-extension://${runtimeId}/`)) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && hostname === 'arxiv.org';
  } catch {
    return false;
  }
}

/**
 * 快捷键：向当前标签页发 TRIGGER_CONVERSION。非 arXiv 页没有 content script，
 * sendMessage 会报 "Could not establish connection"，这里吞掉，不留未处理的 rejection。
 */
export function triggerConversionInActiveTab(tabsApi, runtime, log = () => {}, hooks = {}) {
  tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    const undelivered = () => hooks.onUndelivered && hooks.onUndelivered(tab.id);
    if (hooks.onSent) hooks.onSent(tab.id);
    const onDone = () => {
      const err = runtime && runtime.lastError;
      if (err) {
        log(`快捷键转换未发送：${err.message || err}`);
        undelivered();
      }
    };
    try {
      const result = tabsApi.sendMessage(tab.id, { type: 'TRIGGER_CONVERSION' }, onDone);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          log(`快捷键转换未发送：${err && err.message}`);
          undelivered();
        });
      }
    } catch (err) {
      log(`快捷键转换未发送：${err && err.message}`);
      undelivered();
    }
  });
}
