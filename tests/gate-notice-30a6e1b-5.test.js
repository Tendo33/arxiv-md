// 设计验收 30a6e1b #5：C10 拦截用中性提示，不是红色「失败」卡
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { showNotice, onNextOutcome } from '../src/content/progress-ui';
import { isDisclosureNeeded } from '../src/content/status-error';

describe('abs 页', () => {
  beforeEach(() => {
    const { document, window } = parseHTML(`<!doctype html><html><body>
      <div class="arxiv-md-progress"><div class="progress-row">
      <span class="progress-text"></span><span class="progress-percent"></span></div>
      <div class="progress-detail"></div></div></body></html>`);
    global.document = document;
    global.window = window;
  });
  test('showNotice：中性 canceled 样式、status/polite、无「失败」，popup 收到 notice', () => {
    const got = [];
    if (typeof onNextOutcome === 'function') onNextOutcome((o) => got.push(o));
    showNotice('需要先确认数据说明', '已打开设置页，确认后回到这里再点一次。');
    const box = document.querySelector('.arxiv-md-progress');
    expect(box.classList.contains('error')).toBe(false);
    expect(box.classList.contains('canceled')).toBe(true);
    expect(box.getAttribute('role')).toBe('status');
    expect(box.getAttribute('aria-live')).toBe('polite');
    expect(box.querySelector('.progress-text').textContent).toBe('需要先确认数据说明');
    expect(box.textContent).not.toMatch(/失败|failed/i);
    if (got.length) expect(got[0]).toMatchObject({ ok: false, notice: true, title: '需要先确认数据说明' });
  });
  test('isDisclosureNeeded 识别直接和包在 data 里的失败体', () => {
    expect(isDisclosureNeeded({ success: false, disclosureNeeded: true })).toBe(true);
    expect(isDisclosureNeeded({ data: { success: false, disclosureNeeded: true } })).toBe(true);
    expect(isDisclosureNeeded({ success: false, error: 'x' })).toBe(false);
  });
  test('content/index.js 两处拦截走 showNotice', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/content/index.js'), 'utf8');
    expect(src.match(/isDisclosureNeeded\((failure|response)\)\) \{ showNotice\(t\.pdf_disc_needed_title, t\.pdf_disc_needed_body\)/g)).toHaveLength(2);
  });
});
test('popup：notice 走中性 #alertKey（role=status），不走 showErr', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.js'), 'utf8');
  expect(src).toMatch(/else if \(res\?\.notice\) \{[\s\S]{0,200}showNeedKey\(res\.title/);
  const html = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.html'), 'utf8');
  expect(html).toMatch(/id="alertKey" class="alert info hidden" role="status"/);
});
