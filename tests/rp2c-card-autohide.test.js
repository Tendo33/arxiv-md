// rp2c（设计终验 ④）：「已提交」/「已完成」卡片 10 秒自动收起——悬停或焦点在卡片内暂停、焦点在内永不收、离开后按剩余时间继续（至少 2 秒）；
// 收起没有动画（display:none，卡片无 transition/animation）；计时只有一份，pending 会取消它。
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { showSubmitted, showSuccess, showPending, SUCCESS_VISIBLE_MS, AUTO_HIDE_RESUME_MIN_MS } from '../src/content/progress-ui';

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

let box;
const shown = () => box.style.display !== 'none' && (box.classList.contains('submitted') || box.classList.contains('success'));
const fire = (el, type, init = {}) => { const e = new window.Event(type, { bubbles: type.startsWith('focus') }); Object.assign(e, init); el.dispatchEvent(e); };

describe('rp2c ④ 卡片自动收起', () => {
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
  afterEach(() => {
    // 把模块里的悬停状态复位
    fire(box, 'mouseleave');
    jest.clearAllTimers(); jest.useRealTimers();
  });

  test.each([['submitted', () => showSubmitted('paddleocr')], ['success', () => showSuccess('ok')]])('%s：无交互时 10 秒收起', (_, show) => {
    show();
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS - 1);
    expect(shown()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(shown()).toBe(false);
  });

  test('时长是 10 秒，恢复下限 2 秒', () => {
    expect(SUCCESS_VISIBLE_MS).toBe(10000);
    expect(AUTO_HIDE_RESUME_MIN_MS).toBe(2000);
  });

  test.each([['submitted', () => showSubmitted('mineru')], ['success', () => showSuccess('ok')]])('%s：悬停暂停，移出后按剩余时间继续（不重新计时）', (_, show) => {
    show();
    jest.advanceTimersByTime(4000);
    fire(box, 'mouseenter');
    jest.advanceTimersByTime(60000);
    expect(shown()).toBe(true);
    fire(box, 'mouseleave');
    jest.advanceTimersByTime(6000 - 1); // 剩余 6 秒
    expect(shown()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(shown()).toBe(false);
  });

  test('剩余不足 2 秒时，恢复后至少再留 2 秒', () => {
    showSubmitted('paddleocr');
    jest.advanceTimersByTime(9500);
    fire(box, 'mouseenter');
    jest.advanceTimersByTime(1000);
    fire(box, 'mouseleave');
    jest.advanceTimersByTime(AUTO_HIDE_RESUME_MIN_MS - 1);
    expect(shown()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(shown()).toBe(false);
  });

  test('焦点在卡片内（关闭按钮）永不收起；焦点移出后按剩余时间继续', () => {
    showSubmitted('paddleocr');
    const close = box.querySelector('.arxiv-md-result-actions button');
    jest.advanceTimersByTime(7000);
    close.focus();
    fire(close, 'focusin');
    jest.advanceTimersByTime(600000);
    expect(shown()).toBe(true);
    const out = document.getElementById('outside');
    out.focus();
    fire(close, 'focusout', { relatedTarget: out });
    jest.advanceTimersByTime(3000 - 1); // 剩余 3 秒（focusout 下一拍才恢复，0ms 计时含在内）
    expect(shown()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(shown()).toBe(false);
  });

  test('悬停中移走焦点不会重启计时；鼠标也移出后才计时', () => {
    showSuccess('ok');
    const close = box.querySelector('.arxiv-md-result-actions button');
    fire(box, 'mouseenter');
    close.focus(); fire(close, 'focusin');
    const out = document.getElementById('outside');
    out.focus(); fire(close, 'focusout', { relatedTarget: out });
    jest.advanceTimersByTime(60000);
    expect(shown()).toBe(true);
    fire(box, 'mouseleave');
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS);
    expect(shown()).toBe(false);
  });

  test('计时只有一份：新的提交卡重置计时；pending 取消计时、不自动收起', () => {
    showSuccess('ok');
    jest.advanceTimersByTime(8000);
    showSubmitted('mineru');
    jest.advanceTimersByTime(8000);
    expect(shown()).toBe(true); // 旧计时没在 8 秒时清掉新卡
    showPending('still');
    jest.advanceTimersByTime(60000);
    expect(box.style.display).not.toBe('none');
    expect(box.dataset.pending).toBe('1');
  });

  test('收起无动画：卡片没有 transition/animation，减少动态下也只是 display:none', () => {
    const css = read('src/content/page-button-styles.js');
    const block = css.match(/\.arxiv-md-progress \{[^}]*\}/)[0];
    expect(block).not.toMatch(/transition|animation/);
    expect(css).not.toMatch(/\.arxiv-md-progress[^{]*\{[^}]*(transition|animation)/);
    expect(read('src/content/progress-ui.js')).toMatch(/progressIndicator\.style\.display = 'none'/);
  });
});
