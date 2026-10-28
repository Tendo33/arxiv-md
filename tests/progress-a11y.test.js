import { parseHTML } from 'linkedom';
import { showSuccess, showError, setProgressState, SUCCESS_VISIBLE_MS } from '../src/content/progress-ui';
import { PAGE_BUTTON_STYLES } from '../src/content/page-button-styles';

describe('页面进度区可访问性与停留时间', () => {
  beforeEach(() => {
    const { document, window } = parseHTML(`<!doctype html><html><body>
      <div class="arxiv-md-progress"><div class="progress-row">
      <span class="progress-text"></span><span class="progress-percent"></span></div>
      <div class="progress-detail"></div></div></body></html>`);
    global.document = document;
    global.window = window;
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  test('进度为 status/polite，错误为 alert/assertive', () => {
    const box = document.querySelector('.arxiv-md-progress');
    setProgressState({ text: 'Working', percent: 10, state: 'processing' });
    expect(box.getAttribute('role')).toBe('status');
    expect(box.getAttribute('aria-live')).toBe('polite');
    showError('boom');
    expect(box.getAttribute('role')).toBe('alert');
    expect(box.getAttribute('aria-live')).toBe('assertive');
  });

  test('成功提示停留至少 5 秒并可手动关闭', () => {
    expect(SUCCESS_VISIBLE_MS).toBeGreaterThanOrEqual(5000);
    const box = document.querySelector('.arxiv-md-progress');
    showSuccess('ok');
    jest.advanceTimersByTime(5000);
    expect(box.style.display).toBe('flex');
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS);
    expect(box.style.display).toBe('none');
    showSuccess('ok');
    box.querySelector('.arxiv-md-result-close').dispatchEvent(new window.Event('click'));
    expect(box.style.display).toBe('none');
  });

  test('成功后计时期间开始新转换，不会被计时器清掉', () => {
    const box = document.querySelector('.arxiv-md-progress');
    showSuccess('ok');
    setProgressState({ text: 'Working', percent: 1, state: 'processing' });
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS + 1);
    expect(box.style.display).toBe('flex');
  });

  test('样式：品牌色、暗色、focus-visible、减少动效，无 hover 位移', () => {
    expect(PAGE_BUTTON_STYLES).toContain('#b31b1b');
    expect(PAGE_BUTTON_STYLES).toContain('#f87171');
    expect(PAGE_BUTTON_STYLES).toContain('[data-theme="dark"]');
    expect(PAGE_BUTTON_STYLES).toContain(':focus-visible');
    expect(PAGE_BUTTON_STYLES).toContain('prefers-reduced-motion: reduce');
    expect(PAGE_BUTTON_STYLES).not.toMatch(/translateY/);
  });
});

import { detectPageTheme, isDarkColor } from '../src/content/page-theme';
describe('注入 UI 跟随宿主页面明暗', () => {
  const doc = (bodyBg, htmlBg) => ({ body: { bg: bodyBg }, documentElement: { bg: htmlBg } });
  const style = (el) => ({ backgroundColor: el.bg });
  test('白底 arXiv 页面 → light；深色背景 → dark；透明 body 取 html', () => {
    expect(detectPageTheme(doc('rgb(255, 255, 255)', ''), style)).toBe('light');
    expect(detectPageTheme(doc('rgb(17, 19, 23)', ''), style)).toBe('dark');
    expect(detectPageTheme(doc('rgba(0, 0, 0, 0)', 'rgb(20, 20, 20)'), style)).toBe('dark');
    expect(detectPageTheme(doc('rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'), style)).toBe('light');
    expect(isDarkColor('garbage')).toBeNull();
  });
});
