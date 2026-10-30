import fs from 'fs';
import path from 'path';
import { buildMenuItems, createContextMenus, arxivIdFromLink, LINK_PATTERNS, PAGE_PATTERNS, MENU } from '../src/background/context-menu';
import { isValidArxivId } from '../src/background/message-guards';

function fakeChrome({ lang = 'zh', token = '' } = {}) {
  const created = [];
  const sent = [];
  const updatedListeners = [];
  const store = { language: lang, mineruToken: token };
  return {
    created, sent, updatedListeners, store,
    menus: { removeAll: (cb) => { created.length = 0; cb(); }, create: (item, cb) => { created.push(item); cb && cb(); } },
    runtime: { lastError: null },
    commands: { getAll: async () => [{ name: 'convert-current-paper', shortcut: 'Alt+Shift+M' }] },
    storage: { getLanguage: async () => store.language, getMinerUToken: async () => store.mineruToken, getPdfParseReadiness: async () => ({ ready: !!store.mineruToken, provider: 'mineru' }) },
    tabs: {
      sendMessage: async (id, msg) => { sent.push([id, msg]); return { received: true }; },
      create: async (opts) => ({ id: 99, ...opts }),
      onUpdated: { addListener: (l) => updatedListeners.push(l), removeListener: (l) => updatedListeners.splice(updatedListeners.indexOf(l), 1) },
    },
    badge: { shortcutStarted: jest.fn(), shortcutUndelivered: jest.fn() },
  };
}
const make = (c) => createContextMenus({ ...c, isValidArxivId });

describe('C-3 右键菜单', () => {
  test('页面项只在 arXiv 论文页，链接项用 targetUrlPatterns 只对 arXiv 链接', () => {
    const items = buildMenuItems('zh', { shortcut: 'Alt+Shift+M', hasToken: true });
    const page = items.find((i) => i.id === MENU.PAGE);
    expect(page.contexts).toEqual(['page']);
    expect(page.documentUrlPatterns).toEqual(PAGE_PATTERNS);
    expect(page.title).toBe('导出本论文为 Markdown（Alt+Shift+M）');
    const link = items.find((i) => i.id === MENU.LINK);
    expect(link.contexts).toEqual(['link']);
    expect(link.targetUrlPatterns).toEqual(LINK_PATTERNS);
    expect(link.documentUrlPatterns).toBeUndefined();
    items.forEach((i) => expect(i.contexts).not.toContain('all'));
    items.forEach((i) => expect(i.parentId).toBeUndefined());
  });

  test('R4-15：当前后端没配 Key 时不显示 PDF 解析项；配好后显示后端名，id 仍是 page-mineru', () => {
    expect(buildMenuItems('en', { hasToken: false }).find((i) => i.id === MENU.MINERU)).toBeUndefined();
    expect(MENU.MINERU).toBe('page-mineru');
    expect(buildMenuItems('en', { hasToken: true, provider: 'paddleocr' }).find((i) => i.id === MENU.MINERU).title).toBe('Convert with PDF parsing (PaddleOCR)');
    expect(buildMenuItems('zh', { hasToken: true, provider: 'mineru' }).find((i) => i.id === MENU.MINERU).title).toBe('用 PDF 解析转换（MinerU）');
  });

  test('R4-15：rebuild 按当前后端的 Key 决定是否显示', async () => {
    const c = fakeChrome({ lang: 'en' });
    let active = { id: 'paddleocr', hasKey: false };
    c.storage.getActivePdfProvider = async () => active;
    c.storage.getPdfParseReadiness = async () => ({ ready: !!active.hasKey, provider: active.id });
    const m = make(c);
    await m.refresh();
    expect(c.created.map((i) => i.id)).toEqual([MENU.PAGE, MENU.LINK]);
    active = { id: 'paddleocr', hasKey: true };
    await m.refresh();
    expect(c.created.find((i) => i.id === MENU.MINERU).title).toBe('Convert with PDF parsing (PaddleOCR)');
  });

  test('切换语言 / 填 Token 后重建，文案跟着变', async () => {
    const c = fakeChrome({ lang: 'zh' });
    const m = make(c);
    await m.refresh();
    expect(c.created.map((i) => i.title)).toContain('导出链接指向的论文为 Markdown');
    expect(c.created).toHaveLength(2);
    c.store.language = 'en'; c.store.mineruToken = 'tok';
    await m.refresh();
    expect(c.created).toHaveLength(3);
    expect(c.created.map((i) => i.title)).toContain('Export linked arXiv paper as Markdown');
    expect(c.created.find((i) => i.id === MENU.MINERU).title).toBe('Convert with PDF parsing (MinerU)');
  });

  test('点击页面项向该标签页发 TRIGGER_CONVERSION 并亮徽标', () => {
    const c = fakeChrome(); const m = make(c);
    m.onClicked({ menuItemId: MENU.PAGE }, { id: 5 });
    m.onClicked({ menuItemId: MENU.MINERU }, { id: 5 });
    expect(c.sent).toEqual([[5, { type: 'TRIGGER_CONVERSION', mode: 'markdown' }], [5, { type: 'TRIGGER_CONVERSION', mode: 'mineru' }]]);
    expect(c.badge.shortcutStarted).toHaveBeenCalledWith(5);
  });

  test('发送失败时徽标走失败分支', async () => {
    const c = fakeChrome(); c.tabs.sendMessage = async () => { throw new Error('Receiving end does not exist'); };
    make(c).onClicked({ menuItemId: MENU.PAGE }, { id: 7 });
    await new Promise((r) => setTimeout(r, 0));
    expect(c.badge.shortcutUndelivered).toHaveBeenCalledWith(7);
  });

  test('链接项：开后台 abs 标签页，加载完再触发转换；非法链接忽略', async () => {
    const c = fakeChrome(); const m = make(c);
    expect(m.onClicked({ menuItemId: MENU.LINK, linkUrl: 'https://arxiv.org/pdf/1706.03762v7.pdf' }, { id: 1, index: 2 })).toBe('link');
    await new Promise((r) => setTimeout(r, 0));
    expect(c.updatedListeners).toHaveLength(1);
    c.updatedListeners[0](99, { status: 'loading' });
    expect(c.sent).toHaveLength(0);
    c.updatedListeners[0](99, { status: 'complete' });
    expect(c.sent).toEqual([[99, { type: 'TRIGGER_CONVERSION', mode: 'markdown' }]]);
    expect(c.updatedListeners).toHaveLength(0);
    expect(m.onClicked({ menuItemId: MENU.LINK, linkUrl: 'https://arxiv.org/abs/../../evil' }, { id: 1 })).toBeNull();
  });

  test('arxivIdFromLink', () => {
    expect(arxivIdFromLink('https://arxiv.org/abs/2310.06825', isValidArxivId)).toBe('2310.06825');
    expect(arxivIdFromLink('http://arxiv.org/pdf/hep-th/9901001v1', isValidArxivId)).toBe('hep-th/9901001v1');
    expect(arxivIdFromLink('https://example.com/abs/2310.06825', isValidArxivId)).toBeNull();
  });

  test('manifest 只新增 contextMenus，popup 页脚提示右键入口', () => {
    const mf = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.json'), 'utf8'));
    // 1.2.2：原可选的 DNR 和 PaddleOCR 两个域名移入必需权限，没有其它新增
    expect(mf.permissions).toEqual(['storage', 'downloads', 'activeTab', 'notifications', 'alarms', 'contextMenus', 'declarativeNetRequestWithHostAccess']);
    expect(mf.host_permissions).toHaveLength(8);
    const html = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.html'), 'utf8');
    expect(html).toContain('data-i18n="popup_footer_menu"');
  });
});

// 管理员 Round 3 回复第 2 条：链接菜单只在 arXiv 链接上出现
describe('C-3 链接菜单 targetUrlPatterns 范围', () => {
  // Chrome match pattern 的简化实现：scheme * = http|https，path * = 任意
  const toRe = (p) => {
    const [, scheme, host, path] = p.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
    const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${scheme === '*' ? 'https?' : scheme}://${esc(host)}${esc(path)}$`);
  };
  const hit = (u) => LINK_PATTERNS.some((p) => toRe(p).test(u));
  const link = buildMenuItems('zh').find((i) => i.id === MENU.LINK);

  test('只有 link 上下文、带 targetUrlPatterns、不带 documentUrlPatterns', () => {
    expect(link.contexts).toEqual(['link']);
    expect(link.targetUrlPatterns).toBe(LINK_PATTERNS);
    expect(link.documentUrlPatterns).toBeUndefined();
  });
  test.each([
    'https://arxiv.org/abs/2310.06825', 'http://arxiv.org/pdf/2310.06825v2', 'https://arxiv.org/html/2310.06825',
    'https://www.arxiv.org/abs/2310.06825', 'https://www.arxiv.org/pdf/hep-th/9901001', 'https://www.arxiv.org/html/2310.06825v1',
  ])('匹配并能解析 ID: %s', (u) => {
    expect(hit(u)).toBe(true);
    expect(arxivIdFromLink(u, isValidArxivId)).not.toBeNull();
  });
  test.each([
    'https://example.com/abs/2310.06825', 'https://arxiv.org/list/cs.CL/recent', 'https://export.arxiv.org/abs/2310.06825',
    'https://arxiv.org.evil.com/abs/2310.06825', 'https://www.zhihu.com/question/1', 'https://arxiv.org/',
  ])('不匹配: %s', (u) => expect(hit(u)).toBe(false));
});
