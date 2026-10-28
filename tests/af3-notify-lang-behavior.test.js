// AF3 复审 P3：后台语言接线改成行为测试——storage 里 language=en，不完整分支 → chrome.notifications.create 收到英文
jest.mock('@utils/storage', () => ({
  __esModule: true,
  browserDefaultLanguage: jest.fn(() => 'zh'),
  default: {
    getConversionMode: jest.fn(async () => 'fast'), getMinerUToken: jest.fn(async () => null),
    getIncludeMetadata: jest.fn(async () => true), incrementConversion: jest.fn(async () => {}),
    getLanguage: jest.fn(async () => 'en'),
  },
}));
jest.mock('@core/converter/ar5iv-converter', () => ({ __esModule: true, default: { convert: jest.fn() } }));
import storage from '@utils/storage';
import ar5iv from '@core/converter/ar5iv-converter';
import converter from '@core/converter';
import { translations } from '../src/config/locales';

const incompleteResult = {
  markdown: '# x', title: 'T', metadata: { source: 'arxiv-html' },
  integrity: { complete: false, source: { headings: 58 }, exported: { headings: 25 } },
};

beforeEach(() => {
  global.chrome = {
    storage: { sync: { get: jest.fn(async () => ({})) } },
    notifications: { create: jest.fn() },
  };
  converter._downloadViaContentScript = jest.fn(async () => {});
  ar5iv.convert.mockResolvedValue(incompleteResult);
});

async function notified() {
  await converter.convert({ arxivId: '2402.19173', title: 'T' });
  await new Promise((r) => setTimeout(r, 0));
  expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
  return chrome.notifications.create.mock.calls[0][0];
}

test('language=en（浏览器默认是 zh）→ 英文不完整通知', async () => {
  storage.getLanguage.mockResolvedValue('en');
  const n = await notified();
  expect(n.title).toBe(translations.en.notify_incomplete_title);
  expect(n.message).toMatch(/58/);
  expect(n.message).toMatch(/25/);
  expect(`${n.title}${n.message}`).not.toMatch(/[\u4e00-\u9fff]/);
});

test('language=zh → 中文不完整通知', async () => {
  storage.getLanguage.mockResolvedValue('zh');
  const n = await notified();
  expect(n.title).toBe(translations.zh.notify_incomplete_title);
});
