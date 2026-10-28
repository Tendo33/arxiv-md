import { parseHTML } from 'linkedom';
import { showResult, clearProgressState } from '../src/content/progress-ui';
import { translations } from '../src/config/locales';

describe('conversion result toast', () => {
  let written;
  beforeEach(() => {
    const { document, window } = parseHTML(`<!doctype html><html><body>
      <div class="arxiv-md-progress"><div class="progress-row">
      <span class="progress-text"></span><span class="progress-percent"></span></div>
      <div class="progress-detail"></div></div></body></html>`);
    global.document = document;
    global.window = window;
    written = null;
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText: async (text) => { written = text; } } },
    });
  });

  test('stays visible with filename and copies the exact markdown on click', async () => {
    jest.useFakeTimers();
    showResult({ filename: 'paper.md', markdown: '# Title\n\n$x$' });
    jest.advanceTimersByTime(10000);
    const box = document.querySelector('.arxiv-md-progress');
    expect(box.style.display).toBe('flex');
    expect(box.textContent).toContain('paper.md');
    const copy = document.querySelector('.arxiv-md-copy-btn');
    expect(copy.textContent).toBe(translations.en.content_btn_copy_md);
    copy.dispatchEvent(new window.Event('click'));
    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
    expect(written).toBe('# Title\n\n$x$');
    expect(box.textContent).toContain(translations.en.content_copy_done);
  });

  test('close button hides the result', () => {
    showResult({ filename: 'paper.pdf' });
    expect(document.querySelector('.arxiv-md-copy-btn')).toBeNull();
    document.querySelector('.arxiv-md-result-close').dispatchEvent(new window.Event('click'));
    expect(document.querySelector('.arxiv-md-progress').style.display).toBe('none');
    clearProgressState();
  });
});
