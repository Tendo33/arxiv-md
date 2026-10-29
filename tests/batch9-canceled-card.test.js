/**
 * batch9 设计验收 M3 / S3：下载被取消或已从下载列表移除时，状态卡标题「已取消」（不是「失败」），
 * 读屏走 status/polite；真正的失败仍是「失败」+ alert/assertive。
 */
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';
import { showCanceled, showError } from '../src/content/progress-ui';
import { isCanceledDownload, statusCardErrorText } from '../src/content/status-error';

const t = translations.en; // progress-ui 在 node 测试环境下用 en

function mount() {
  const { document, window } = parseHTML(`<!doctype html><html><body>
    <div class="arxiv-md-progress"><div class="progress-row">
    <span class="progress-text"></span><span class="progress-percent"></span></div>
    <div class="progress-detail"></div></div></body></html>`);
  global.document = document;
  global.window = window;
  return document.querySelector('.arxiv-md-progress');
}

describe('batch9 已取消卡片', () => {
  test('标题「已取消」，读屏 status/polite，不显示百分比', () => {
    const box = mount();
    showCanceled(t.content_error_download_removed);
    const title = box.querySelector('.progress-text').textContent;
    expect(title).toBe('Canceled');
    expect(box.querySelector('.progress-detail').textContent).toBe(t.content_error_download_removed);
    expect(box.textContent).not.toContain(t.content_progress_failed);
    expect(box.getAttribute('role')).toBe('status');
    expect(box.getAttribute('aria-live')).toBe('polite');
    expect(box.querySelector('.progress-percent').textContent).toBe('');
    // R5-04：中性「已取消」样式，不再是红色错误卡
    expect(box.classList.contains('canceled')).toBe(true);
    expect(box.classList.contains('error')).toBe(false);
  });

  test('真正的失败仍是 alert/assertive', () => {
    const box = mount();
    showCanceled('x');
    showError('boom');
    expect(box.getAttribute('role')).toBe('alert');
    expect(box.getAttribute('aria-live')).toBe('assertive');
  });

  test('isCanceledDownload：canceled / removed 为真，其他失败为假', () => {
    expect(isCanceledDownload({ downloadFailure: 'canceled' })).toBe(true);
    expect(isCanceledDownload({ success: false, downloadFailure: 'removed' })).toBe(true);
    expect(isCanceledDownload({ data: { success: false, downloadFailure: 'removed' } })).toBe(true);
    for (const f of [{ downloadFailure: 'network' }, { downloadFailure: 'server' }, { error: 'x' }, null, new Error('y')]) {
      expect(isCanceledDownload(f)).toBe(false);
    }
  });

  test('zh/en 文案（设计替换表）', () => {
    expect(translations.zh.content_progress_canceled).toBe('已取消');
    expect(translations.en.content_progress_canceled).toBe('Canceled');
    for (const l of ['zh', 'en']) {
      const tt = translations[l];
      expect(statusCardErrorText({ downloadFailure: 'removed' }, tt)).toBe(tt.content_error_download_removed);
      expect(tt.notify_download_canceled_title).toBe(tt.content_error_download_canceled);
    }
  });

  test('content/index.js 失败出口（含 P3② 的补发）都先判断已取消', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/content/index.js'), 'utf8');
    expect(src.match(/\(isCanceledDownload\([\w.]+\) \? showCanceled : showError\)\(statusCardErrorText/g)).toHaveLength(4);
    expect(src).toMatch(/else if \(message\.data && isPendingShown\(id\)\)/); // P3①
  });
});

describe('R5-04 已取消卡片：关闭按钮 + 10 秒自动收起', () => {
  afterEach(() => jest.useRealTimers());
  test('有「关闭」按钮，点击即收起', () => {
    const box = mount();
    showCanceled('x');
    const btn = box.querySelector('.arxiv-md-result-close');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe(t.content_btn_close);
    btn.dispatchEvent(new window.Event('click'));
    expect(box.style.display).toBe('none');
  });
  test('10 秒后自动收起（9.9 秒时仍在）', () => {
    jest.useFakeTimers();
    const box = mount();
    showCanceled('x');
    jest.advanceTimersByTime(9900);
    expect(box.style.display).toBe('flex');
    jest.advanceTimersByTime(200);
    expect(box.style.display).toBe('none');
  });
  test('期间开始新状态（失败）→ 不误清', () => {
    jest.useFakeTimers();
    const box = mount();
    showCanceled('x');
    showError('boom');
    jest.advanceTimersByTime(11000);
    expect(box.style.display).toBe('flex');
    expect(box.classList.contains('error')).toBe(true);
  });
  test('CSS：.canceled 是中性色，不用 danger', () => {
    const css = require('fs').readFileSync(require('path').join(__dirname, '../src/content/page-button-styles.js'), 'utf8');
    const m = css.match(/\.arxiv-md-progress\.canceled \{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m[1]).not.toMatch(/danger/);
  });
});
