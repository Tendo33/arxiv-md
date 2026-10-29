// Round 3 C-3：右键菜单（layout-v2 §5 / B1-4，文案见 prd-v2 §7.3）
// 依赖全部注入，便于在 node 里测试。
import { translations } from '@config/locales';
import { defaultTimers } from './action-badge';
import { providerLabel } from '@config/pdf-providers';

export const PAGE_PATTERNS = [
  'https://arxiv.org/abs/*',
  'https://arxiv.org/pdf/*',
  'https://arxiv.org/html/*',
];
// 只对指向 arXiv 论文的链接显示（targetUrlPatterns），不出现在其他链接上：
// abs / pdf / html，带与不带 www.（www.arxiv.org 会跳转到 arxiv.org）
export const LINK_PATTERNS = ['abs', 'pdf', 'html'].flatMap((k) => [
  `*://arxiv.org/${k}/*`,
  `*://www.arxiv.org/${k}/*`,
]);

export const MENU = {
  PAGE: 'page-download',
  MINERU: 'page-mineru',
  LINK: 'link-download',
};

const LINK_ID = /^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf|html)\/([^?#]+?)(?:\.pdf)?\/?(?:[?#].*)?$/i;

/** 链接 → arXiv ID（不合法返回 null） */
export function arxivIdFromLink(url, isValid) {
  const m = String(url || '').match(LINK_ID);
  if (!m) return null;
  const id = decodeURIComponent(m[1]);
  return isValid(id) ? id : null;
}

/** 生成菜单项（纯函数） */
export function buildMenuItems(lang, { shortcut = '', hasToken = false, provider = 'mineru' } = {}) {
  const t = translations[lang] || translations.en;
  const pageTitle = shortcut
    ? t.menu_with_shortcut.replace('{label}', t.menu_page_download).replace('{shortcut}', shortcut)
    : t.menu_page_download;
  // R4-15：id 保持 page-mineru（兼容）；只在当前后端已配 Key 时显示
  const items = [{ id: MENU.PAGE, title: pageTitle, contexts: ['page'], documentUrlPatterns: PAGE_PATTERNS }];
  if (hasToken) {
    items.push({
      id: MENU.MINERU, contexts: ['page'], documentUrlPatterns: PAGE_PATTERNS,
      title: t.menu_page_mineru.replace('{provider}', providerLabel(provider)),
    });
  }
  items.push({ id: MENU.LINK, title: t.menu_link_download, contexts: ['link'], targetUrlPatterns: LINK_PATTERNS });
  return items;
}

/**
 * 不建显式父项：Chrome 父项不会因子项全被过滤而隐藏，会在所有网页留下空的子菜单。
 * 顶层多项时 Chrome 自动收进以扩展名「arXiv to Markdown」命名的子菜单，只剩一项时直接显示。
 */
export const LINK_LOAD_TIMEOUT_MS = 30000;

export function createContextMenus({ menus, tabs, runtime, commands, storage, isValidArxivId, badge, log = () => {}, timers = defaultTimers, loadTimeoutMs = LINK_LOAD_TIMEOUT_MS }) {
  let building = Promise.resolve();

  async function rebuild() {
    const lang = (await storage.getLanguage().catch(() => 'en')) || 'en';
    const active = storage.getActivePdfProvider
      ? await storage.getActivePdfProvider().catch(() => ({ id: 'mineru', hasKey: false }))
      : { id: 'mineru', hasKey: !!(await storage.getMinerUToken().catch(() => '')) };
    const hasToken = active.hasKey;
    const provider = active.id;
    let shortcut = '';
    try {
      const all = commands && commands.getAll ? await commands.getAll() : [];
      shortcut = (all.find((c) => c.name === 'convert-current-paper') || {}).shortcut || '';
    } catch (_) { /* 无快捷键 */ }
    await new Promise((r) => menus.removeAll(() => r()));
    buildMenuItems(lang, { shortcut, hasToken, provider }).forEach((item) => {
      menus.create(item, () => { if (runtime.lastError) log(`menu ${item.id}: ${runtime.lastError.message}`); });
    });
  }

  function refresh() {
    building = building.then(rebuild, rebuild);
    return building;
  }

  function sendTrigger(tabId, mode, onUndelivered) {
    if (badge) badge.shortcutStarted(tabId);
    return Promise.resolve(tabs.sendMessage(tabId, { type: 'TRIGGER_CONVERSION', mode })).then(() => true, (err) => {
      log(`右键转换未发送：${err && err.message}`);
      if (badge) badge.shortcutUndelivered(tabId);
      if (onUndelivered) onUndelivered();
      return false;
    });
  }

  /**
   * 链接导出：后台开一个不激活的 abs 标签页，加载完成后在该页触发转换（复用现有管线，不加 host 权限）。
   * 审查建议 2：监听在 create 之前挂上；完成、标签页被关、超时、create 失败时都会移除 onUpdated/onRemoved。
   * 失败时在发起页（没有则在新页）显示工具栏 "!" 徽标，不新增权限。
   * @returns {Promise<{ok:boolean, reason?:string, tabId?:number}>}
   */
  function exportLink(arxivId, openerTab) {
    const url = `https://arxiv.org/abs/${arxivId}`;
    const opts = { url, active: false };
    if (openerTab && openerTab.id != null) opts.openerTabId = openerTab.id;
    if (openerTab && openerTab.index != null) opts.index = openerTab.index + 1;
    return new Promise((resolve) => {
      let tabId = null;
      let timer = null;
      let settled = false;
      const early = new Set();
      const cleanup = () => {
        tabs.onUpdated.removeListener(onUpdated);
        if (tabs.onRemoved) tabs.onRemoved.removeListener(onRemoved);
        if (timer !== null) timers.clearTimeout(timer);
      };
      const failFeedback = () => {
        const target = openerTab && openerTab.id != null ? openerTab.id : tabId;
        if (badge && target != null && typeof badge.fail === 'function') badge.fail(target);
      };
      const fail = (reason) => {
        if (settled) return;
        settled = true; cleanup();
        log(`右键链接导出失败（${reason}）：${url}`);
        failFeedback();
        resolve({ ok: false, reason, tabId });
      };
      const ready = () => {
        if (settled) return;
        settled = true; cleanup();
        // content script 在 document_end 注入，complete 时已就绪
        sendTrigger(tabId, 'markdown', failFeedback).then((ok) => resolve(ok ? { ok: true, tabId } : { ok: false, reason: 'undelivered', tabId }));
      };
      function onUpdated(id, info) {
        if (!info || info.status !== 'complete') return;
        if (tabId === null) early.add(id);
        else if (id === tabId) ready();
      }
      function onRemoved(id) { if (id === tabId) fail('closed'); }
      tabs.onUpdated.addListener(onUpdated);
      if (tabs.onRemoved) tabs.onRemoved.addListener(onRemoved);
      Promise.resolve(tabs.create(opts)).then((tab) => {
        tabId = tab.id;
        if (tab.status === 'complete' || early.has(tab.id)) return ready();
        timer = timers.setTimeout(() => fail('timeout'), loadTimeoutMs);
      }, (err) => fail(`create: ${err && err.message}`));
    });
  }

  function onClicked(info, tab) {
    switch (info.menuItemId) {
    case MENU.PAGE:
      if (tab && tab.id != null) sendTrigger(tab.id, 'markdown');
      return 'page';
    case MENU.MINERU:
      if (tab && tab.id != null) sendTrigger(tab.id, 'mineru');
      return 'mineru';
    case MENU.LINK: {
      const id = arxivIdFromLink(info.linkUrl, isValidArxivId);
      if (!id) { log(`忽略非 arXiv 链接：${info.linkUrl}`); return null; }
      exportLink(id, tab);
      return 'link';
    }
    default:
      return null;
    }
  }

  return { refresh, onClicked, exportLink };
}
