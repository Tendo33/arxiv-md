// release-polish AB8-04：语言统一走 storage.getLanguage → browserDefaultLanguage 兜底
global.chrome = { storage: { sync: {}, local: {} }, i18n: { getUILanguage: () => 'en' } };
const { default: storage, browserDefaultLanguage } = require('../src/utils/storage');
const { createContextMenus } = require('../src/background/context-menu');

const ui = (l) => { global.chrome = { ...(global.chrome || {}), i18n: { getUILanguage: () => l } }; };
afterEach(() => jest.restoreAllMocks());

test.each([
  [undefined, 'zh-CN', 'zh'], [undefined, 'en-US', 'en'], ['auto', 'zh-TW', 'zh'], ['fr', 'de', 'en'], ['en', 'zh-CN', 'en'], ['zh', 'en', 'zh'],
])('存的值 %p + 浏览器 %s → %s', async (saved, uiLang, want) => {
  ui(uiLang);
  jest.spyOn(storage, 'get').mockImplementation(async (k, d) => (saved === undefined ? d : saved));
  expect(await storage.getLanguage()).toBe(want);
});
test('读取失败也回落到浏览器语言，不抛', async () => {
  ui('zh-CN');
  jest.spyOn(storage, 'get').mockRejectedValue(new Error('boom'));
  expect(await storage.getLanguage()).toBe('zh');
  expect(browserDefaultLanguage('zh-HK')).toBe('zh');
});
test('右键菜单：getLanguage 失败时用浏览器语言而不是写死 en', async () => {
  ui('zh-CN');
  const created = [];
  const menus = { removeAll: (cb) => (cb ? cb() : Promise.resolve()), create: (o, cb) => { created.push(o); cb && cb(); }, onClicked: { addListener() {} } };
  const cm = createContextMenus({
    menus, tabs: { onUpdated: { addListener() {} }, onRemoved: { addListener() {} } }, runtime: { lastError: null },
    commands: { getAll: async () => [] }, isValidArxivId: () => true, badge: {},
    storage: { getLanguage: () => Promise.reject(new Error('x')), getMinerUToken: async () => '', getPdfParseReadiness: async () => ({ ready: false, provider: 'paddleocr' }) },
  });
  await cm.refresh();
  const titles = created.map((o) => o.title).join('|');
  expect(titles).toMatch(/[\u4e00-\u9fff]/);
});
