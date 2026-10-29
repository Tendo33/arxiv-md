import { parseHTML } from 'linkedom';
import { showPending, showError, showSuccess, SUCCESS_VISIBLE_MS } from '../src/content/progress-ui';
import { statusCardErrorText } from '../src/content/status-error';
import { translations } from '../src/config/locales';

const t = translations.en;

describe('batch9 ①：pending 状态卡（中性、无百分比、不说完成/失败）', () => {
  beforeEach(() => {
    const { document, window } = parseHTML(`<!doctype html><html><body>
      <div class="arxiv-md-progress"><div class="progress-row">
      <span class="progress-text"></span><span class="progress-percent"></span></div>
      <div class="progress-detail"></div></div></body></html>`);
    global.document = document;
    global.window = window;
  });
  afterEach(() => jest.useRealTimers());

  test('标题「Still downloading」，无百分比，无 success/error/warning 样式', () => {
    showPending(t.content_download_pending);
    const box = document.querySelector('.arxiv-md-progress');
    expect(box.querySelector('.progress-text').textContent).toBe('Still downloading');
    expect(box.querySelector('.progress-percent').textContent).toBe('');
    expect(box.querySelector('.progress-detail').textContent).toBe(t.content_download_pending);
    for (const c of ['success', 'error', 'warning']) expect(box.classList.contains(c)).toBe(false);
    expect(box.getAttribute('role')).toBe('status');
    expect(box.textContent).not.toContain(t.content_progress_completed);
    expect(box.textContent).not.toContain(t.content_progress_failed);
    expect(box.textContent).not.toContain('100%');
    expect(box.querySelector('.arxiv-md-result-close')).not.toBeNull();
  });

  test('zh 标题是「仍在下载」且不同于完成/失败标题', () => {
    expect(translations.zh.content_progress_still_downloading).toBe('仍在下载');
    expect(translations.zh.content_progress_still_downloading).not.toBe(translations.zh.content_progress_completed);
  });

  test('停留 SUCCESS_VISIBLE_MS 后收起；期间被新状态替换则不误清', () => {
    jest.useFakeTimers();
    showPending(t.content_download_pending);
    const box = document.querySelector('.arxiv-md-progress');
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS - 1);
    expect(box.style.display).toBe('flex');
    jest.advanceTimersByTime(1);
    expect(box.style.display).toBe('none');
    showPending(t.content_download_pending);
    showError('x');
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS);
    expect(box.style.display).toBe('flex');
    expect(box.dataset.pending).toBeUndefined();
  });

  test('成功卡仍是 100% success（对照）', () => {
    showSuccess('ok');
    expect(document.querySelector('.progress-percent').textContent).toBe('100%');
  });
});

describe('batch9 ②：removed 卡片走与 canceled 相同的路径', () => {
  test('removed 与 canceled 都由 statusCardErrorText 出 content_error_download_*，同为 showError 样式', () => {
    for (const l of ['zh', 'en']) {
      const tt = translations[l];
      expect(statusCardErrorText({ downloadFailure: 'canceled' }, tt)).toBe(tt.content_error_download_canceled);
      expect(statusCardErrorText({ downloadFailure: 'removed' }, tt)).toBe(tt.content_error_download_removed);
      expect(tt.notify_download_removed_title).toBe(tt.notify_download_canceled_title);
    }
  });
});
