// QA L-01：后台真实接线——DNR 没就绪时的 reinit 不会在设置页 / popup 开着时 runtime.reload
jest.mock('@utils/storage', () => ({ __esModule: true, browserDefaultLanguage: jest.fn(() => 'en'), default: { getLanguage: jest.fn(async () => 'zh') } }));
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
let pages;
beforeAll(() => {
  global.chrome = {
    storage: { local: { get: jest.fn(async () => ({})), set: jest.fn(async () => {}) }, onChanged: { addListener: jest.fn() } },
    notifications: { create: jest.fn() },
    runtime: { reload: jest.fn(), getContexts: jest.fn(async () => pages) },
  };
});

test('设置页开着 → 不重载；关掉后 → 重载一次', async () => {
  const { backgroundReinit } = require('../src/background/mineru-task-runner');
  pages = [{ contextType: 'TAB' }];
  backgroundReinit({ isIdle: () => true });
  await tick(1500);
  expect(chrome.runtime.reload).not.toHaveBeenCalled();
  pages = [];
  await tick(1200);
  expect(chrome.runtime.reload).toHaveBeenCalledTimes(1);
});
