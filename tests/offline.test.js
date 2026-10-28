import { parseHTML } from 'linkedom';
import { isNetworkError } from '../src/utils/network-error';
import converter from '../src/core/converter/ar5iv-converter';
import { setProgressState, clearProgressState } from '../src/content/progress-ui';
import { translations } from '../src/config/locales';

describe('离线 / 网络错误', () => {
  test('识别 fetch 网络层失败和离线状态', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'), { onLine: true })).toBe(true);
    expect(isNetworkError(new Error('net::ERR_INTERNET_DISCONNECTED'), { onLine: true })).toBe(true);
    expect(isNetworkError(new Error('anything'), { onLine: false })).toBe(true);
    expect(isNetworkError(new Error('Cannot find main content'), { onLine: true })).toBe(false);
  });

  test('所有 HTML 来源都断网时抛出网络错误，而不是“版本不存在”', async () => {
    const original = global.fetch;
    global.fetch = jest.fn(async () => { throw new TypeError('Failed to fetch'); });
    try {
      await expect(converter.convert('1706.03762', null)).rejects.toThrow('Failed to fetch');
    } finally {
      global.fetch = original;
    }
  });

  test('中文和英文都有明确的断网提示', () => {
    expect(translations.zh.content_error_offline).toBe('网络连接失败，请检查网络后重试');
    expect(translations.en.content_error_offline).toMatch(/Network connection failed/);
  });

  test('隐藏进度条时清掉上一次的“Completed 100%”', () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <div class="arxiv-md-progress"><span class="progress-text"></span>
      <span class="progress-percent"></span><div class="progress-detail"></div></div></body></html>`);
    global.document = document;
    setProgressState({ text: 'Completed', percent: 100, state: 'success' });
    clearProgressState();
    const box = document.querySelector('.arxiv-md-progress');
    expect(box.style.display).toBe('none');
    expect(box.textContent.trim()).toBe('');
  });
});
