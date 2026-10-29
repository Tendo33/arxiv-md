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
import { downloadFile, downloadFailureKind, showNotification, DOWNLOAD_TIMEOUT_MS, DOWNLOAD_KEEPALIVE_MS } from '@utils/helpers';
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
        if (mode.searchEmpty) return [];
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
        if (mode.earlyOther) fire({ id: 99, state: { previous: 'in_progress', current: 'complete' } });
        if (mode.interruptAt) setTimeout(() => fire({ id: 7, state: { current: 'interrupted' }, error: { current: 'USER_CANCELED' } }), mode.interruptAt);
        if (mode.completeAt) setTimeout(() => fire({ id: 7, state: { previous: 'in_progress', current: 'complete' } }), mode.completeAt);
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

  test('审查 P3②：拿到 id 前另一个下载（id 99）先 complete → 不算本次成功，仍等自己的事件', async () => {
    const c = fakeChrome({ earlyOther: true, interrupt: 'SERVER_FORBIDDEN' });
    await expect(downloadFile('u', 'p.pdf')).rejects.toMatchObject({ code: 'DOWNLOAD_INTERRUPTED', downloadError: 'SERVER_FORBIDDEN' });
    expect(c.listeners.size).toBe(0);
  });

  test('审查阻断项：超过 30 秒的下载，等待期间每 20 秒 search 一次（keepalive），完成后停止', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ completeAt: 75_000 });
    let result;
    const p = downloadFile('u', 'p.pdf').then((v) => { result = v; });
    await jest.advanceTimersByTimeAsync(0);
    expect(c.downloads.search).toHaveBeenCalledTimes(1); // 拿到 id 后立即一次
    await jest.advanceTimersByTimeAsync(20_000);
    expect(c.downloads.search).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(20_000); // 40s：没有任何 onChanged，仍靠 search 保持活跃
    expect(c.downloads.search).toHaveBeenCalledTimes(3);
    expect(result).toBeUndefined();
    await jest.advanceTimersByTimeAsync(40_000); // 60s 再 poll 一次，75s complete
    await p;
    expect(result).toBe(7);
    expect(c.downloads.search).toHaveBeenCalledTimes(4);
    expect(c.listeners.size).toBe(0);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(c.downloads.search).toHaveBeenCalledTimes(4); // 结束后不再调用
    expect(jest.getTimerCount()).toBe(0);
  });

  test('审查阻断项：search 兜底漏掉的 onChanged（50 秒时 search 看到 complete）', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ never: true });
    const p = downloadFile('u', 'p.pdf');
    await jest.advanceTimersByTimeAsync(30_000);
    c.downloads.search.mockImplementation(async ({ id }) => [{ id, state: 'complete' }]);
    await jest.advanceTimersByTimeAsync(10_000); // 40s poll
    await expect(p).resolves.toBe(7);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('审查阻断项：默认超时 4 分钟（低于 Chrome 单事件 5 分钟上限），之后不再 poll', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ never: true });
    expect(DOWNLOAD_TIMEOUT_MS).toBe(240_000);
    expect(DOWNLOAD_KEEPALIVE_MS).toBeLessThan(30_000);
    const settled = downloadFile('u', 'p.pdf').catch((e) => e);
    await jest.advanceTimersByTimeAsync(239_000);
    expect(c.listeners.size).toBe(1);
    await jest.advanceTimersByTimeAsync(1_001);
    expect((await settled).code).toBe('DOWNLOAD_STILL_RUNNING');
    const calls = c.downloads.search.mock.calls.length;
    expect(calls).toBe(12); // 立即 1 次 + 20s…220s 共 11 次；240s 那次与超时同刻，超时先注册先触发
    await jest.advanceTimersByTimeAsync(60_000);
    expect(c.downloads.search.mock.calls.length).toBe(calls);
    expect(c.listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('batch9 ①：超时 → reject DOWNLOAD_STILL_RUNNING（类别 pending），没有 onLateComplete 时监听器移除', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ never: true });
    const p = downloadFile('u', 'p.pdf', { timeoutMs: 1000 });
    const settled = p.catch((e) => e);
    await jest.advanceTimersByTimeAsync(1001);
    const err = await settled;
    expect(err.code).toBe('DOWNLOAD_STILL_RUNNING');
    expect(downloadFailureKind(err)).toBe('pending');
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
  [{ searchEmpty: true }, 'download_removed', 'content_error_download_removed', undefined],
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
    for (const k of ['download_failed', 'download_failed_network', 'download_failed_server', 'download_failed_file']) {
      expect(t[`notify_${k}_title`]).toBe(t.notify_download_failed_title);
    }
    expect(t.content_error_download_other).toBe(lang === 'zh' ? '下载失败' : 'Download failed');
  });
});

test('zh/en 新增 key 对齐', () => {
  const pick = (l) => Object.keys(translations[l]).filter((k) => /^(notify_download_|content_error_download_)/.test(k)).sort();
  expect(pick('zh')).toEqual(pick('en'));
  expect(pick('zh')).toHaveLength(20);
});

test('content/index.js 两处 PDF 按钮失败都按下载失败显示', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/content/index.js'), 'utf8');
  expect(src.match(/statusCardErrorText\([^)]*'PDF download failed', \{ download: true \}\)/g)).toHaveLength(2);
});

describe('batch9 ①：4 分钟后仍在下载 → 不报失败、不取消；之后完成补发「已保存」', () => {
  test('超时后只留 onChanged 监听，不再 poll，没有定时器；complete 到来时调用 onLateComplete 并移除监听', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ completeAt: 300_000 });
    c.downloads.cancel = jest.fn();
    const late = jest.fn();
    const settled = downloadFile('u', 'p.pdf', { onLateComplete: late }).catch((e) => e);
    await jest.advanceTimersByTimeAsync(240_001);
    const err = await settled;
    expect(err.code).toBe('DOWNLOAD_STILL_RUNNING');
    expect(err.downloadId).toBe(7);
    expect(c.listeners.size).toBe(1);
    const polls = c.downloads.search.mock.calls.length;
    expect(jest.getTimerCount()).toBe(1); // 只剩假下载自己的 completeAt
    await jest.advanceTimersByTimeAsync(60_000);
    expect(late).toHaveBeenCalledWith(7);
    expect(late).toHaveBeenCalledTimes(1);
    expect(c.listeners.size).toBe(0);
    expect(c.downloads.search.mock.calls.length).toBe(polls);
    expect(c.downloads.cancel).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  // batch9 审查 P3①：补发等待阶段按 id 过滤、只认终态
  test('超时后其他 id 先 complete → 忽略，监听仍在；本 id 之后 complete 照常补发', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({});
    const late = jest.fn();
    const settled = downloadFile('u', 'p.pdf', { onLateComplete: late }).catch((e) => e);
    await jest.advanceTimersByTimeAsync(240_001);
    expect((await settled).code).toBe('DOWNLOAD_STILL_RUNNING');
    const fire = (d) => [...c.listeners].forEach((l) => l(d));
    fire({ id: 99, state: { previous: 'in_progress', current: 'complete' } });
    expect(late).not.toHaveBeenCalled();
    expect(c.listeners.size).toBe(1);
    fire({ id: 7, state: { previous: 'in_progress', current: 'complete' } });
    expect(late).toHaveBeenCalledWith(7);
    expect(c.listeners.size).toBe(0);
  });

  test('超时后本 id 变为 paused → 不补发成功也不补发失败，监听仍在；之后 complete 照常补发', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({});
    const late = jest.fn();
    const lateFail = jest.fn();
    const settled = downloadFile('u', 'p.pdf', { onLateComplete: late, onLateFailure: lateFail }).catch((e) => e);
    await jest.advanceTimersByTimeAsync(240_001);
    expect((await settled).code).toBe('DOWNLOAD_STILL_RUNNING');
    const fire = (d) => [...c.listeners].forEach((l) => l(d));
    fire({ id: 7, paused: { previous: false, current: true } });
    fire({ id: 7, filename: { current: '/x/p.pdf' } });
    expect(late).not.toHaveBeenCalled();
    expect(lateFail).not.toHaveBeenCalled();
    expect(c.listeners.size).toBe(1);
    fire({ id: 7, state: { previous: 'in_progress', current: 'complete' } });
    expect(late).toHaveBeenCalledTimes(1);
    expect(lateFail).not.toHaveBeenCalled();
    expect(c.listeners.size).toBe(0);
  });

  test('超时后下载被中断 → 不补发，监听移除', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ interruptAt: 250_000 });
    const late = jest.fn();
    const settled = downloadFile('u', 'p.pdf', { onLateComplete: late }).catch((e) => e);
    await jest.advanceTimersByTimeAsync(260_000);
    expect((await settled).code).toBe('DOWNLOAD_STILL_RUNNING');
    expect(late).not.toHaveBeenCalled();
    expect(c.listeners.size).toBe(0);
  });

  // batch9 M2：pending 卡片不自动收起，补完成时后台给发起页发 PDF_DOWNLOAD_SETTLED 把卡片换掉
  test.each([
    ['downloadPdf', (p) => converter.downloadPdf(p, 42)],
    ['_fallbackToPdf', (p) => converter._fallbackToPdf(p, null, 42)],
  ])('%s：补完成时通知发起页 PDF_DOWNLOAD_SETTLED', async (_n, run) => {
    jest.useFakeTimers();
    const c = fakeChrome({ completeAt: 300_000 });
    c.tabs = { sendMessage: jest.fn(() => Promise.resolve()) };
    run(paper);
    await jest.advanceTimersByTimeAsync(240_001);
    expect(c.tabs.sendMessage).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(c.tabs.sendMessage).toHaveBeenCalledWith(42, { type: 'PDF_DOWNLOAD_SETTLED', data: { ok: true, filename: 'p.pdf' } });
  });

  describe.each([['zh'], ['en']])('通知与状态卡（%s）', (lang) => {
    const t = translations[lang];
    beforeEach(() => { showNotification.mockClear(); storage.getLanguage.mockResolvedValue(lang); });

    test.each([['downloadPdf', 'pdf_saved'], ['_fallbackToPdf', 'pdf_fallback']])('%s：先通知仍在下载、结果 pending，之后完成补发 %s', async (fn, savedKey) => {
      jest.useFakeTimers();
      const c = fakeChrome({ completeAt: 300_000 });
      c.downloads.cancel = jest.fn();
      let r;
      converter[fn](paper).then((v) => { r = v; });
      await jest.advanceTimersByTimeAsync(240_001);
      expect(r).toMatchObject({ success: true, pending: true, filename: 'p.pdf' });
      expect(last()).toEqual([t.notify_download_pending_title, t.notify_download_pending_body, 'basic']);
      expect(showNotification).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(60_000);
      expect(last()).toEqual([t[`notify_${savedKey}_title`], t[`notify_${savedKey}_body`].replace('{filename}', 'p.pdf'), 'basic']);
      expect(c.downloads.cancel).not.toHaveBeenCalled();
      expect(c.listeners.size).toBe(0);
    });
  });

  test('zh/en 文案', () => {
    // batch9 设计验收 M1：标题已是「仍在下载」，正文不再重复
    expect(translations.zh.content_download_pending).toBe('完成后会出现在浏览器的下载列表');
    expect(translations.zh.notify_download_pending_body).toBe('完成后会出现在浏览器的下载列表');
    expect(translations.en.content_download_pending).toBe('It\'ll appear in your browser\'s downloads when it finishes.');
    expect(translations.en.notify_download_pending_body).toBe(translations.en.content_download_pending);
    for (const l of ['zh', 'en']) {
      const title = translations[l].content_progress_still_downloading;
      expect(translations[l].content_download_pending).not.toContain(title);
      expect(translations[l].notify_download_pending_body).not.toContain(title);
    }
    for (const l of ['zh', 'en']) {
      expect(translations[l].notify_download_pending_title).not.toBe(translations[l].notify_download_failed_title);
      expect(translations[l]).not.toHaveProperty('content_error_download_timeout');
    }
  });

  test('content/index.js 两处结果处理都先看 pending', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/content/index.js'), 'utf8');
    expect(src.match(/pending\) \{\n\s*showPending\(t\.content_download_pending\)/g)).toHaveLength(2);
    expect(src).not.toMatch(/showSuccess\(t\.content_download_pending\)/);
  });
});

describe('batch9 ②：search 返回空数组 → 立刻 reject「已取消或已从列表移除」', () => {
  test('不等超时；监听器和定时器都清掉', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ searchEmpty: true });
    const settled = downloadFile('u', 'p.pdf').catch((e) => e);
    await jest.advanceTimersByTimeAsync(0);
    const err = await settled;
    expect(err.code).toBe('DOWNLOAD_REMOVED');
    expect(downloadFailureKind(err)).toBe('removed');
    expect(c.listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(1); // 只剩假下载自己的 5ms 事件
  });

  test('keepalive 中途变成空数组（用户之后才移除）→ 那一次 poll 就 reject', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ never: true });
    const settled = downloadFile('u', 'p.pdf').catch((e) => e);
    await jest.advanceTimersByTimeAsync(30_000);
    c.downloads.search.mockImplementation(async () => []);
    await jest.advanceTimersByTimeAsync(10_000);
    expect((await settled).code).toBe('DOWNLOAD_REMOVED');
    expect(c.listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('search 返回 undefined 或抛错时不算移除，继续等', async () => {
    jest.useFakeTimers();
    const c = fakeChrome({ never: true });
    c.downloads.search.mockImplementation(async () => undefined);
    let state = 'waiting';
    downloadFile('u', 'p.pdf', { timeoutMs: 60_000 }).catch((e) => { state = e.code; });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(state).toBe('waiting');
    await jest.advanceTimersByTimeAsync(30_001);
    expect(state).toBe('DOWNLOAD_STILL_RUNNING');
  });

  test('zh/en 文案', () => {
    // batch9 设计验收 M3：卡片和通知同一句
    expect(translations.zh.content_error_download_removed).toBe('下载已取消，或已从下载列表中移除');
    expect(translations.zh.notify_download_removed_body).toBe('下载已取消，或已从下载列表中移除');
    expect(translations.en.content_error_download_removed).toBe('The download was canceled or removed from your downloads.');
    expect(translations.en.notify_download_removed_body).toBe(translations.en.content_error_download_removed);
  });
});
