const store = {};
global.chrome = {
  storage: { sync: { get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) } },
  i18n: { getUILanguage: () => 'zh-CN' },
};
const { default: storage, browserDefaultLanguage } = require('../src/utils/storage');

describe('首次运行语言跟随浏览器', () => {
  test('zh-CN / zh-TW / zh → 中文，其余英文', () => {
    expect(browserDefaultLanguage('zh-CN')).toBe('zh');
    expect(browserDefaultLanguage('zh-TW')).toBe('zh');
    expect(browserDefaultLanguage('zh')).toBe('zh');
    expect(browserDefaultLanguage('en-US')).toBe('en');
    expect(browserDefaultLanguage('ja')).toBe('en');
    expect(browserDefaultLanguage('')).toBe('en');
  });
  test('未保存语言时用浏览器语言；保存后以保存值为准', async () => {
    expect(await storage.getLanguage()).toBe('zh');
    await storage.setLanguage('en');
    expect(await storage.getLanguage()).toBe('en');
  });
});
