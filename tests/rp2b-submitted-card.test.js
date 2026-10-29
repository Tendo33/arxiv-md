// rp2b（设计 ③）：异步后端（PaddleOCR / MinerU）提交成功后的页面卡片是「已提交」，不是「已完成」。
// 无百分比、无进度条；信息蓝 + 时钟图标（与 popup S-2 一致）；正文带实际后端名；只有「关闭」；读屏 polite。
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { showSubmitted, setProgressState, SUCCESS_VISIBLE_MS } from '../src/content/progress-ui';
import { translations } from '../src/config/locales';

const t = translations.en;
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('rp2b ③ 提交卡', () => {
  beforeEach(() => {
    const { document, window } = parseHTML(`<!doctype html><html><body>
      <div class="arxiv-md-progress"><div class="progress-row">
      <span class="progress-text"></span><span class="progress-percent">42%</span></div>
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <div class="progress-detail"></div></div></body></html>`);
    global.document = document;
    global.window = window;
    jest.useFakeTimers();
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  test.each([['mineru', 'MinerU'], ['paddleocr', 'PaddleOCR']])('%s：标题 Submitted，无百分比，正文带后端名', (id, label) => {
    showSubmitted(id);
    const box = document.querySelector('.arxiv-md-progress');
    expect(box.querySelector('.progress-text').textContent).toBe('Submitted');
    expect(box.querySelector('.progress-percent').textContent).toBe('');
    expect(box.querySelector('.progress-detail').textContent).toBe(t.content_submitted_body.replace('{provider}', label));
    expect(box.textContent).not.toMatch(/100%|Completed|Done/);
    expect(box.textContent).not.toContain(t.content_progress_completed);
  });

  test('submitted 样式、进度条隐藏、非 success；时钟图标；只有一个关闭按钮；aria-live polite', () => {
    showSubmitted('mineru');
    const box = document.querySelector('.arxiv-md-progress');
    expect(box.classList.contains('submitted')).toBe(true);
    expect(box.querySelector(".progress-bar").hidden).toBe(true);
    for (const c of ['success', 'error', 'warning']) expect(box.classList.contains(c)).toBe(false);
    expect(box.querySelectorAll('.progress-row .progress-icon').length).toBe(1);
    const buttons = box.querySelectorAll('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].classList.contains('arxiv-md-result-close')).toBe(true);
    expect(box.getAttribute('aria-live')).toBe('polite');
  });

  test('新一轮进度会去掉 submitted 样式和时钟图标', () => {
    showSubmitted('mineru');
    setProgressState({ text: 'x', percent: 10, state: 'processing' });
    const box = document.querySelector('.arxiv-md-progress');
    expect(box.classList.contains('submitted')).toBe(false);
    expect(box.querySelector('.progress-icon')).toBeNull();
  });

  test('8 秒后收起（与旧提交提示一致）', () => {
    showSubmitted('mineru');
    jest.advanceTimersByTime(SUCCESS_VISIBLE_MS + 10);
    expect(document.querySelector('.arxiv-md-progress').classList.contains('submitted')).toBe(false);
  });

  test('zh 文案与设计一致', () => {
    expect(translations.zh.content_progress_submitted).toBe('已提交');
    expect(translations.zh.content_submitted_body).toBe('{provider} 正在解析，完成后会通知你。可在扩展弹窗的「PDF 解析任务」里查看');
    expect(t.content_submitted_body).toBe("{provider} is parsing it. You'll be notified when it's done. Track it under PDF parsing tasks in the popup.");
  });

  test('接线：content 的 background 分支走 showSubmitted；converter 返回实际后端；CSS 有信息蓝与暗色', () => {
    expect(read('src/content/index.js')).toMatch(/data\?\.background\)\s*\{[\s\S]{0,120}showSubmitted\(response\.data\.provider\)/);
    expect((read('src/core/converter/index.js').match(/background: true[^}]*provider/g) || []).length).toBe(2);
    const css = read('src/content/page-button-styles.js');
    expect(css).toMatch(/--amd-info:\s*#1f5fbf/i);
    expect(css).toMatch(/--amd-info:\s*#7cb2ff/i);
    expect(css).toMatch(/\.arxiv-md-progress\.submitted/);
  });
});
