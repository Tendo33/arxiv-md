// 系统通知 i18n：PDF 解析任务通知按扩展设置的语言、按错误码 / reason 选文案，不展示 e.message
jest.mock('@utils/storage', () => ({
  __esModule: true,
  browserDefaultLanguage: jest.fn(() => 'en'),
  default: { getLanguage: jest.fn(async () => 'zh') },
}));
import storage, { browserDefaultLanguage } from '@utils/storage';
import { translations } from '../src/config/locales';
import { ParseError } from '../packages/pdf-parse-core/src/errors';

let showTaskNotification;
beforeAll(() => {
  global.chrome = {
    storage: { local: { get: jest.fn(async () => ({})), set: jest.fn(async () => {}) }, onChanged: { addListener: jest.fn() } },
    notifications: { create: jest.fn() },
    runtime: {},
  };
  ({ showTaskNotification } = require('../src/background/mineru-task-runner'));
});
beforeEach(() => { chrome.notifications.create.mockClear(); });

const task = { id: 't1', paperInfo: { title: 'Attention Is All You Need', arxivId: '1706.03762' } };
const provider = { label: 'MinerU' };
async function send(lang, status, detail) {
  storage.getLanguage.mockResolvedValue(lang);
  await showTaskNotification(task, status, detail, provider);
  expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
  const [id, cfg] = chrome.notifications.create.mock.calls[0];
  expect(id).toBe('mineru_task_t1');
  return cfg;
}
const han = /[\u4e00-\u9fff]/;

describe('已知 reason / code', () => {
  const err = () => new ParseError('PROVIDER_FAILED', { provider: 'mineru', reason: 'forbidden_empty', httpStatus: 403, message: 'RAW-403 secret body' });
  test('zh：reason=forbidden_empty → err_reason_forbidden_empty', async () => {
    const c = await send('zh', 'failed', err());
    expect(c.title).toBe('❌ PDF 解析失败（MinerU）');
    expect(c.message).toContain(translations.zh.err_reason_forbidden_empty.replace('{provider}', 'MinerU'));
    expect(c.message).not.toContain('RAW-403');
  });
  test('en：reason=forbidden_empty → 英文，且无中文', async () => {
    const c = await send('en', 'failed', err());
    expect(c.title).toBe('❌ PDF parsing failed (MinerU)');
    expect(c.message).toContain(translations.en.err_reason_forbidden_empty.replace('{provider}', 'MinerU'));
    expect(c.message).not.toContain('RAW-403');
    expect(c.title + c.message.replace(task.paperInfo.title, '')).not.toMatch(han);
  });
  test('en：code=QUOTA_EXCEEDED → err_QUOTA_EXCEEDED（填好 provider）', async () => {
    const c = await send('en', 'failed', new ParseError('QUOTA_EXCEEDED', { message: 'raw quota text' }));
    expect(c.message).toContain('MinerU quota exhausted');
    expect(c.message).not.toContain('raw quota text');
  });
});

describe('认不出的错误 → 通用失败文案，不带 e.message', () => {
  test.each([
    ['PROVIDER_FAILED 无已知 reason', () => new ParseError('PROVIDER_FAILED', { reason: 'weird_thing', message: 'TypeError: x is undefined at foo.js:12' })],
    ['普通 Error', () => new Error('TypeError: x is undefined at foo.js:12')],
    ['字符串', () => 'TypeError: x is undefined at foo.js:12'],
  ])('%s', async (_n, mk) => {
    for (const lang of ['zh', 'en']) {
      chrome.notifications.create.mockClear();
      const c = await send(lang, 'failed', mk());
      expect(c.message).toContain(translations[lang].notify_task_failed_generic.replace('{provider}', 'MinerU'));
      expect(c.message).not.toMatch(/TypeError|foo\.js|weird_thing/);
    }
  });
});

test('扩展设置优先于浏览器语言：浏览器 en、设置 zh → 中文；浏览器 zh、设置 en → 英文', async () => {
  browserDefaultLanguage.mockReturnValue('en');
  let c = await send('zh', 'failed', new ParseError('TIMEOUT'));
  expect(c.message).toContain('MinerU 处理超时');
  chrome.notifications.create.mockClear();
  browserDefaultLanguage.mockReturnValue('zh');
  c = await send('en', 'failed', new ParseError('TIMEOUT'));
  expect(c.message).toContain('MinerU timed out');
  chrome.notifications.create.mockClear();
  c = await send('auto', 'failed', new ParseError('TIMEOUT')); // 非 zh/en → 浏览器默认
  expect(c.message).toContain('MinerU 处理超时');
});

test('完成通知也按设置语言；1.2.2 起没有待确认通知', async () => {
  let c = await send('en', 'completed', 'x.md');
  expect(c.title).toBe('✅ PDF parsed (MinerU)');
  expect(c.buttons).toEqual([{ title: 'View task' }]);
  chrome.notifications.create.mockClear();
  c = await send('zh', 'completed', 'x.md');
  expect(c.buttons).toEqual([{ title: '查看任务' }]);
  chrome.notifications.create.mockClear();
  c = await send('en', 'completed', 'x.md');
  expect(c.title + c.message.replace(task.paperInfo.title, '')).not.toMatch(han);
});

test('getLanguage 抛错 → 回落浏览器默认，不抛', async () => {
  browserDefaultLanguage.mockReturnValue('en');
  storage.getLanguage.mockRejectedValueOnce(new Error('boom'));
  await showTaskNotification(task, 'failed', new ParseError('TIMEOUT'), provider);
  expect(chrome.notifications.create.mock.calls[0][1].message).toContain('MinerU timed out');
});

test('runner 把错误对象（不是 e.message）交给通知层', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'background', 'parse-task-runner.js'), 'utf8');
  expect(src).toMatch(/notify\(task, 'failed', e, provider\)/);
});
