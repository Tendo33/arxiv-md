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
    // 徽标钩子只是反馈：任何异常都吞掉，不能阻断 sendMessage（A2-01）
    const safeHook = (name) => {
      try {
        if (hooks[name]) hooks[name](tab.id);
      } catch (err) {
        log(`徽标更新失败：${err && err.message}`);
      }
    };
    const undelivered = () => safeHook('onUndelivered');
    safeHook('onSent');
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

/**
 * 审查 P1-1：只有扩展自己的页面（弹窗/设置页）能确认发送；content script 带 sender.tab，一律拒绝，
 * 这样网页里的脚本没法替用户点「发送并解析」。
 */
export function isExtensionPageSender(sender, runtimeId) {
  if (!sender || sender.id !== runtimeId || sender.tab) return false;
  return typeof sender.url === 'string' && sender.url.startsWith(`chrome-extension://${runtimeId}/`);
}

/** P3-5：OPEN_DISCLOSURE 只接受本扩展 arxiv.org 内容脚本 / 扩展页面发来的、已知后端 id；返回是否打开了 */
export const DISCLOSURE_PROVIDERS = ['paddleocr', 'mineru'];
export function handleOpenDisclosure(message, sender, runtimeId, open) {
  if (!isTrustedArxivSender(sender, runtimeId)) return false;
  if (!message || !DISCLOSURE_PROVIDERS.includes(message.provider)) return false;
  open(message.provider);
  return true;
}
