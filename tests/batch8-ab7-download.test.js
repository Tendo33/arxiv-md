/**
 * batch8 AB7-01：downloadFile 等下载到终态（complete / interrupted）才判定；超时；任何结局都移除监听器；
 * 「监听前已结束」的竞态由 search() 兜底。失败原因 → zh/en 文案（通知 + 状态卡），原始原因只进日志。
 * batch8 AB7-02：PDF 下载失败时状态卡写「下载失败」，和通知一致。
 */
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('@utils/storage', () => ({
  __esModule: true,
  default: {
    getConversionMode: jest.fn(async () => 'fast'), getMinerUToken: jest.fn(async () => 'tok'),
    getIncludeMetadata: jest.fn(async () => true), incrementConversion: jest.fn(async () => {}),
    getLanguage: jest.fn(async () => 'zh'),
  },
}));
jest.mock('@core/converter/ar5iv-converter', () => ({ __esModule: true, default: { convert: jest.fn() } }));
jest.mock('@utils/helpers', () => ({
  __esModule: true,
  ...jest.requireActual('@utils/helpers'),
  generateFilename: jest.fn(() => 'p.pdf'),
  showNotification: jest.fn(),
}));
import storage from '@utils/storage';
import { downloadFile, downloadFailureKind, showNotification } from '@utils/helpers';
import converter from '@core/converter';
import { translations } from '@config/locales';
import { statusCardErrorText } from '../src/content/status-error';

/**
 * 假的 chrome.downloads：
 * mode = { complete } | { interrupt: REASON } | { never } | { startError } |
 *        { earlyComplete }（在 download 回调之前就发出 complete 事件）|
 *        { searchState: 'complete' | 'interrupted', searchError }（事件在挂监听前已发完，只有 search 能看到）
 */
function fakeChrome(mode) {
  const listeners = new Set();
  const fire = (d) => [...listeners].forEach((l) => l(d));
  const chrome = {
    runtime: { lastError: null },
    downloads: {
      onChanged: {
        addListener: jest.fn((l) => listeners.add(l)),
        removeListener: jest.fn((l) => listeners.delete(l)),
      },
      search: jest.fn(async ({ id }) => {
        if (mode.searchState) return [{ id, state: mode.searchState, error: mode.searchError }];
        return [{ id, state: 'in_progress' }];
      }),
      download: jest.fn((opts, cb) => {
        if (mode.startError) {
          chrome.runtime.lastError = { message: mode.startError };
          cb(undefined);
          chrome.runtime.lastError = null;
          return;
        }
        if (mode.earlyComplete) fire({ id: 7, state: { previous: 'in_progress', current: 'complete' } });
        cb(7);
        setTimeout(() => {
          fire({ id: 99, state: { current: 'interrupted' }, error: { current: 'NETWORK_FAILED' } }); // 别的下载，不应影响
          if (mode.complete) fire({ id: 7, state: { previous: 'in_progress', current: 'complete' } });
          if (mode.interrupt) {
            fire({ id: 7, error: { current: mode.interrupt } });
            fire({ id: 7, state: { previous: 'in_progress', current: 'interrupted' }, error: { current: mode.interrupt } });
          }
        }, 5);
      }),
    },
    listeners,
  };
  global.chrome = chrome;
  return chrome;
}

afterEach(() => { delete global.chrome; jest.useRealTimers(); });

describe('downloadFile 等待终态', () => {
  test('complete → resolve(id)，监听器已移除', async () => {
    const c = fakeChrome({ complete: true });
    await expect(downloadFile('u', 'p.pdf')).resolves.toBe(7);
    expect(c.listeners.size).toBe(0);
    expect(c.downloads.onChanged.removeListener).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['SERVER_BAD_CONTENT', 'server'], ['SERVER_FORBIDDEN', 'server'], ['SERVER_FAILED', 'server'],
    ['NETWORK_FAILED', 'network'], ['NETWORK_TIMEOUT', 'network'], ['NETWORK_DISCONNECTED', 'network'],
    ['USER_CANCELED', 'canceled'], ['USER_SHUTDOWN', 'canceled'],
    ['FILE_NO_SPACE', 'file'], ['FILE_ACCESS_DENIED', 'file'], ['CRASH', 'other'],
  ])('interrupted %s → reject，类别 %s，监听器已移除', async (reason, kind) => {
    const c = fakeChrome({ interrupt: reason });
    const err = await downloadFile('u', 'p.pdf').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('DOWNLOAD_INTERRUPTED');
    expect(err.downloadError).toBe(reason);
    expect(downloadFailureKind(err)).toBe(kind);
    expect(c.listeners.size).toBe(0);
  });

  test('竞态：complete 事件早于拿到 id → 缓存后仍判定成功', async () => {
    const c = fakeChrome({ earlyComplete: true });
    await expect(downloadFile('u', 'p.pdf')).resolves.toBe(7);
    expect(c.listeners.size).toBe(0);
  });

  test.each([
    [{ searchState: 'complete' }, null],
    [{ searchState: 'interrupted', searchError: 'SERVER_FORBIDDEN' }, 'SERVER_FORBIDDEN'],
  ])('竞态：事件在挂监听前已发完，靠 search() 判定 %j', async (mode, reason) => {
    const c = fakeChrome(mode);
    const p = downloadFile('u', 'p.pdf');
    if (reason) await expect(p).rejects.toMatchObject({ code: 'DOWNLOAD_INTERRUPTED', downloadError: reason });
    else await expect(p).resolves.toBe(7);
    expect(c.downloads.search).toHaveBeenCalledWith({ id: 7 });
    expect(c.listeners.size).toBe(0);
  });

  test('超时 → reject DOWNLOAD_TIMEOUT，监听器已移除，之后的事件不再生效', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ never: true });
    const p = downloadFile('u', 'p.pdf', { timeoutMs: 1000 });
    const settled = p.catch((e) => e);
    await jest.advanceTimersByTimeAsync(1001);
    const err = await settled;
    expect(err.code).toBe('DOWNLOAD_TIMEOUT');
    expect(downloadFailureKind(err)).toBe('timeout');
    expect(c.listeners.size).toBe(0);
    expect(c.downloads.onChanged.removeListener).toHaveBeenCalledTimes(1);
  });

  test('download() 启动就失败（lastError）→ reject，监听器和定时器都清掉', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ startError: 'Invalid filename' });
    await expect(downloadFile('u', 'p.pdf')).rejects.toMatchObject({ message: 'Invalid filename' });
    expect(c.listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('成功时定时器也清掉', async () => {
    fakeChrome({ complete: true });
    const spy = jest.spyOn(global, 'clearTimeout');
    await downloadFile('u', 'p.pdf');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

const CASES = [
  // [fake 模式, 通知 key, 状态卡 key, errorCode]
  [{ interrupt: 'SERVER_FORBIDDEN' }, 'download_failed_server', 'content_error_download_server', undefined],
  [{ interrupt: 'SERVER_BAD_CONTENT' }, 'download_failed_server', 'content_error_download_server', undefined],
  [{ interrupt: 'NETWORK_FAILED' }, 'download_failed_network', 'content_error_offline', 'NETWORK_OFFLINE'],
  [{ interrupt: 'USER_CANCELED' }, 'download_canceled', 'content_error_download_canceled', undefined],
  [{ interrupt: 'FILE_NO_SPACE' }, 'download_failed_file', 'content_error_download_file', undefined],
  [{ startError: 'Invalid filename' }, 'download_failed', 'content_error_download_other', undefined],
];
const last = () => showNotification.mock.calls[showNotification.mock.calls.length - 1];
const paper = { arxivId: '2401.00001', title: 'T' };

describe.each([['zh'], ['en']])('通知与状态卡（%s）', (lang) => {
  const t = translations[lang];
  beforeEach(() => { showNotification.mockClear(); storage.getLanguage.mockResolvedValue(lang); });

  test('页面 PDF 按钮：complete 才提示已保存', async () => {
    fakeChrome({ complete: true });
    const r = await converter.downloadPdf(paper);
    expect(r.success).toBe(true);
    expect(last()[0]).toBe(t.notify_pdf_saved_title);
  });

  test.each(CASES)('页面 PDF 按钮 %j → 通知 %s，状态卡 %s', async (mode, notifyKey, cardKey, errorCode) => {
    fakeChrome(mode);
    const r = await converter.downloadPdf(paper);
    expect(r.success).toBe(false);
    expect(last()).toEqual([t[`notify_${notifyKey}_title`], t[`notify_${notifyKey}_body`], 'basic']);
    expect(last()[0]).not.toBe(t.notify_pdf_saved_title);
    expect(r.errorCode).toBe(errorCode);
    expect(statusCardErrorText(r, t, 'PDF download failed', { download: true })).toBe(t[cardKey]);
    // 原始原因不进用户文案
    expect(`${last()[0]}${last()[1]}${t[cardKey]}`).not.toMatch(/SERVER_|NETWORK_|USER_CANCELED|FILE_|Invalid filename/);
  });

  test.each(CASES)('快捷键的 PDF 回退 %j → 同一通知，状态卡同一文案', async (mode, notifyKey, cardKey) => {
    fakeChrome(mode);
    const r = await converter._fallbackToPdf(paper);
    expect(r.success).toBe(false);
    expect(last()).toEqual([t[`notify_${notifyKey}_title`], t[`notify_${notifyKey}_body`], 'basic']);
    // content/index.js 快捷键路径：response.data 是后台结果
    expect(statusCardErrorText({ success: true, data: r }, t, 'Conversion failed')).toBe(t[cardKey]);
  });

  test('快捷键的 PDF 回退：complete 才提示已保存为 PDF', async () => {
    fakeChrome({ complete: true });
    const r = await converter._fallbackToPdf(paper);
    expect(r.success).toBe(true);
    expect(last()[0]).toBe(t.notify_pdf_fallback_title);
  });

  test('AB7-02：PDF 按钮失败、没有类别（如消息异常）时状态卡也写下载失败，不写转换失败', () => {
    expect(statusCardErrorText(new Error('boom'), t, 'PDF download failed', { download: true })).toBe(t.content_error_download_other);
    expect(t.content_error_download_other).not.toBe(t.content_error_generic);
    // 失败类通知标题都是「下载失败」；取消单独说「已取消」
    for (const k of ['download_failed', 'download_failed_network', 'download_failed_server', 'download_failed_file', 'download_timeout']) {
      expect(t[`notify_${k}_title`]).toBe(t.notify_download_failed_title);
    }
    expect(t.content_error_download_other).toBe(lang === 'zh' ? '下载失败' : 'Download failed');
  });
});

test('zh/en 新增 key 对齐', () => {
  const pick = (l) => Object.keys(translations[l]).filter((k) => /^(notify_download_|content_error_download_)/.test(k)).sort();
  expect(pick('zh')).toEqual(pick('en'));
  expect(pick('zh')).toHaveLength(18);
});

test('content/index.js 两处 PDF 按钮失败都按下载失败显示', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/content/index.js'), 'utf8');
  expect(src.match(/statusCardErrorText\([^)]*'PDF download failed', \{ download: true \}\)/g)).toHaveLength(2);
});
