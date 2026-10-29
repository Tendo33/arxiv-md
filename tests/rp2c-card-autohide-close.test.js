// rp2c 复审 P2：悬停时点「关闭」→ 卡片 display:none，不会再有 mouseleave；
// 模块级 cardHovered 不能因此卡在 true，之后的卡片仍要按时自动收起。
// 本文件故意不在 afterEach 里补发 mouseleave。
import { parseHTML } from 'linkedom';
import { showSubmitted, showSuccess, SUCCESS_VISIBLE_MS } from '../src/content/progress-ui';

let box;
const shown = () => box.style.display !== 'none' && (box.classList.contains('submitted') || box.classList.contains('success'));
const fire = (el, type, init = {}) => { const e = new window.Event(type, { bubbles: type.startsWith('focus') }); Object.assign(e, init); el.dispatchEvent(e); };
const closeBtn = () => box.querySelector('.arxiv-md-result-close');

describe('rp2c P2 关闭后悬停状态复位', () => {
  beforeEach(() => {
    const { document, window } = parseHTML(`<!doctype html><html><body><button id="outside">x</button>
      <div class="arxiv-md-progress"><div class="progress-row">
      <span class="progress-text"></span><span class="progress-percent"></span></div>
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <div class="progress-detail"></div></div></body></html>`);
    global.document = document;
    global.window = window;
    global.chrome = { runtime: { sendMessage: () => undefined } };
    jest.useFakeTimers();
    box = document.querySelector('.arxiv-md-progress');
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  test('悬停后点关闭（无 mouseleave），新卡片 10 秒后收起', () => {
    showSubmitted('paddleocr');
    fire(box, 'mouseenter');
    closeBtn().click();
    expect(box.style.display).toBe('none');
    showSuccess('ok');
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS - 1);
    expect(shown()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(shown()).toBe(false);
  });

  test('焦点在卡片内时鼠标移出，卡片不收起', () => {
    showSubmitted('mineru');
    const close = closeBtn();
    fire(box, 'mouseenter');
    // linkedom 没有焦点模型：用 activeElement 模拟「焦点在关闭按钮上」
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => close });
    fire(close, 'focusin');
    fire(box, 'mouseleave');
    jest.advanceTimersByTime(600000);
    expect(shown()).toBe(true);
  });

  test('关闭后，旧计时不会收起新卡片', () => {
    showSuccess('ok');
    jest.advanceTimersByTime(6000);
    closeBtn().click();
    showSubmitted('paddleocr');
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS - 1); // 旧计时本应在 +4s 触发
    expect(shown()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(shown()).toBe(false);
  });
});
