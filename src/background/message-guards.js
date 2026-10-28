// 后台消息的防御性校验，单独成模块便于测试

const ARXIV_ID = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i;

export function isValidArxivId(id) {
  return typeof id === 'string' && ARXIV_ID.test(id);
}

/**
 * 只接受本扩展自己的消息；来自标签页时必须是 arXiv 页面（content script 只注入在 arxiv.org）
 */
export function isTrustedArxivSender(sender, runtimeId) {
  if (!sender || !runtimeId || sender.id !== runtimeId) return false;
  if (!sender.tab) return true; // 扩展自身页面（popup/settings）
  try {
    const { protocol, hostname } = new URL(sender.tab.url || sender.url || '');
    return protocol === 'https:' && hostname === 'arxiv.org';
  } catch {
    return false;
  }
}

/**
 * 快捷键：向当前标签页发 TRIGGER_CONVERSION。非 arXiv 页没有 content script，
 * sendMessage 会报 "Could not establish connection"，这里吞掉，不留未处理的 rejection。
 */
export function triggerConversionInActiveTab(tabsApi, runtime, log = () => {}) {
  tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    const onDone = () => {
      const err = runtime && runtime.lastError;
      if (err) log(`快捷键转换未发送：${err.message || err}`);
    };
    try {
      const result = tabsApi.sendMessage(tab.id, { type: 'TRIGGER_CONVERSION' }, onDone);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => log(`快捷键转换未发送：${err && err.message}`));
      }
    } catch (err) {
      log(`快捷键转换未发送：${err && err.message}`);
    }
  });
}
