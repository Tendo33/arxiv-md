/**
 * abs-buttons v2（design-abs-buttons-2026-10-29 §1、§5.6/5.7，旧编号 A1–A3）：
 * 结束态都有 16px 状态图标；失败行有「关闭」；已取消用中性色；状态行独占一行（R05 的 CSS 前提，e2e 见 scripts/e2e-abs-buttons.js）。
 */
import { parseHTML } from 'linkedom';
import { PAGE_BUTTON_STYLES } from '../src/content/page-button-styles';
import { showError, showCanceled, showSubmitted, stateIcon } from '../src/content/progress-ui';

function mount() {
  const { document, window } = parseHTML(`<!doctype html><html><body><div class="arxiv-md-btn-container">
    <div class="arxiv-md-progress"><div class="progress-row"><span class="progress-text"></span><span class="progress-percent"></span></div>
    <div class="progress-detail"></div></div></div></body></html>`);
  global.document = document;
  global.window = window;
  return document.querySelector('.arxiv-md-progress');
}

describe('A2 状态图标', () => {
  test.each([['error', showError], ['canceled', showCanceled]])('%s：标题前一个 16px aria-hidden 图标', (state, fn) => {
    const box = mount();
    fn('x');
    const icons = box.querySelectorAll('.progress-row svg.progress-icon');
    expect(icons.length).toBe(1);
    expect(icons[0].getAttribute('width')).toBe('16');
    expect(icons[0].getAttribute('aria-hidden')).toBe('true');
    expect(icons[0].dataset.state).toBe(state);
  });
  test('已提交：只有一个时钟图标（不再另外 prepend）', () => {
    const box = mount();
    showSubmitted('paddleocr');
    expect(box.querySelectorAll('.progress-icon').length).toBe(1);
  });
  test('状态切换不留旧图标', () => {
    const box = mount();
    showError('a'); showCanceled('b');
    expect([...box.querySelectorAll('.progress-icon')].map((i) => i.dataset.state)).toEqual(['canceled']);
  });
  test('stateIcon 未知状态也返回 svg（无路径）', () => {
    mount();
    expect(stateIcon('x').childNodes.length).toBe(0);
  });
});

describe('A2/A3 失败行与 CSS', () => {
  test('失败行有「关闭」按钮（不自动收起）', () => {
    const box = mount();
    showError('boom');
    expect(box.querySelector('.arxiv-md-result-actions button')).toBeTruthy();
  });
  test('状态行独占一行；已取消用中性色；按钮 32px', () => {
    expect(PAGE_BUTTON_STYLES).toMatch(/\.arxiv-md-progress, \.arxiv-md-hint, \.arxiv-md-auto \{ flex: 0 0 100%;/);
    expect(PAGE_BUTTON_STYLES).toMatch(/\.arxiv-md-progress\.canceled {2}\.progress-icon[^{]*\{ color: var\(--amd-text-2\); \}/);
    expect(PAGE_BUTTON_STYLES).toMatch(/\.arxiv-md-btn \{ height: 32px;/);
  });
});
