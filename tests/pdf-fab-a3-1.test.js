import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { mountPdfFab } from '../src/content/pdf-fab';
import { translations } from '../src/config/locales';
import { DEFAULTS } from '../src/config/constants';

const labels = (lang) => {
  const t = translations[lang];
  return { idle: t.content_fab_idle, run: t.content_fab_run, ok: t.content_fab_ok, err: t.content_fab_err };
};

describe('A3-1 PDF 页悬浮按钮', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test.each(['zh', 'en'])('%s：挂到页面、点击触发、状态切换并同步 aria-label，成功 4 秒后回到空闲', (lang) => {
    const { document } = parseHTML('<html><body><embed type="application/pdf"></body></html>');
    const onClick = jest.fn();
    const fab = mountPdfFab(document, { labels: labels(lang), onClick });
    expect(document.getElementById('arxiv-md-pdf-fab')).toBeTruthy();
    expect(fab.button.getAttribute('aria-label')).toBe(translations[lang].content_fab_idle);
    fab.button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    fab.setState('run');
    expect(fab.button.getAttribute('aria-busy')).toBe('true');
    fab.button.click();
    expect(onClick).toHaveBeenCalledTimes(1); // 进行中不重复触发
    fab.setState('ok');
    expect(fab.button.className).toBe('fab ok');
    expect(fab.button.getAttribute('aria-label')).toBe(translations[lang].content_fab_ok);
    jest.advanceTimersByTime(4000);
    expect(fab.getState()).toBe('idle');
    fab.setState('err');
    expect(fab.button.getAttribute('aria-label')).toBe(translations[lang].content_fab_err);
    jest.advanceTimersByTime(6000);
    expect(fab.getState()).toBe('idle');
    fab.remove();
    expect(document.getElementById('arxiv-md-pdf-fab')).toBeNull();
  });

  test('默认显示；设置页有开关并即时保存；只在 PDF 页挂载', () => {
    expect(DEFAULTS.SHOW_PDF_FAB).toBe(true);
    const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
    expect(html).toMatch(/id="showPdfFab" checked/);
    expect(fs.readFileSync(path.join(__dirname, '../src/ui/settings/instant-save.js'), 'utf8')).toContain('#showPdfFab');
    const idx = fs.readFileSync(path.join(__dirname, '../src/content/index.js'), 'utf8');
    expect(idx).toMatch(/if \(isArxivPdfPage\) await setupPdfFab\(\)/);
    expect(idx).toMatch(/onNextOutcome\(\(res\) => fab\.setState/);
  });

  test('reduced-motion 下不转圈', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/content/pdf-fab.js'), 'utf8');
    expect(src).toMatch(/prefers-reduced-motion:reduce\)\{[^@]*\.fab\.run \.ring\{animation:none/);
  });
});
