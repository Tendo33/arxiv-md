/**
 * AF3 设计验收：页面条不完整态——标题带 ⚠，文件名单独一行（浅色）
 */
import { parseHTML } from 'linkedom';
import { showResult, clearProgressState } from '../src/content/progress-ui';
import { translations } from '../src/config/locales';
import { PAGE_BUTTON_STYLES } from '../src/content/page-button-styles';

describe('AF3 设计验收：页面条', () => {
  beforeEach(() => {
    const { document, window } = parseHTML(`<!doctype html><html><body>
      <div class="arxiv-md-progress"><div class="progress-row">
      <span class="progress-text"></span><span class="progress-percent"></span></div>
      <div class="progress-detail"></div></div></body></html>`);
    global.document = document;
    global.window = window;
  });

  test.each(['zh', 'en'])('%s 标题带单色 ⚠', (lang) => {
    expect(translations[lang].content_progress_incomplete.startsWith('\u26a0 ')).toBe(true);
    expect(translations[lang].content_progress_incomplete).not.toMatch(/\uFE0F/);
  });

  test('不完整：说明和文件名分两行，文件名在 .progress-file', () => {
    showResult({ filename: 'paper.md', integrity: { expectedSections: 58, exportedSections: 25 } });
    const bar = document.querySelector('.arxiv-md-progress');
    expect(bar.querySelector('.progress-text').textContent).toMatch(/^\u26a0 /);
    const detail = bar.querySelector('.progress-detail').textContent;
    expect(detail).toMatch(/58/);
    expect(detail).toMatch(/25/);
    expect(detail).not.toMatch(/paper\.md/);
    const file = bar.querySelector('.progress-file');
    expect(file).not.toBeNull();
    expect(file.textContent).toMatch(/paper\.md/);
    expect(file.previousElementSibling).toBe(bar.querySelector('.progress-detail'));
  });

  test('成功态不出现 .progress-file；清除后也移除', () => {
    showResult({ filename: 'paper.md', integrity: { expectedSections: 58, exportedSections: 25 } });
    clearProgressState();
    expect(document.querySelector('.progress-file')).toBeNull();
    showResult({ filename: 'ok.md' });
    expect(document.querySelector('.progress-file')).toBeNull();
    expect(document.querySelector('.progress-detail').textContent).toMatch(/ok\.md/);
  });

  test('文件名行用浅色 --amd-text-2', () => {
    const css = PAGE_BUTTON_STYLES;
    expect(css).toMatch(/\.progress-file\s*\{[^}]*color:\s*var\(--amd-text-2\)/);
  });
});
