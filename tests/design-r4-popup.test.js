// R4 设计验收：popup 版式（M3、M9）与建议项（待确认样式、后端标签字号）
import fs from 'fs';
import path from 'path';
import { translations } from '../src/config/locales';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');

describe('M9 待确认行在英文窄宽下不挤掉标题', () => {
  test('英文徽标和行内按钮够短', () => {
    expect(translations.en.popup_status_awaiting.length).toBeLessThanOrEqual(8);
    expect(translations.en.popup_action_consent.length).toBeLessThanOrEqual(8);
  });
  test('行内确认按钮限宽 + 省略号', () => {
    expect(css).toMatch(/\.row\[data-status=awaiting_consent\] \.row-act \.btn\[data-action=consent\]\{max-width:7em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  });
});

describe('建议：待确认有单独的等待样式', () => {
  test('task-list 用 wait；CSS 有 .badge.wait 且与 run 不同色', () => {
    const { createTaskRow, setTaskListLanguage } = require('../src/ui/popup/task-list');
    setTaskListLanguage('zh');
    const wait = createTaskRow({ id: 'a', status: 'awaiting_consent', provider: 'paddleocr', paperInfo: { title: 'T' }, createdAt: Date.now() });
    const run = createTaskRow({ id: 'b', status: 'processing', provider: 'paddleocr', paperInfo: { title: 'T' }, createdAt: Date.now() });
    expect(wait).toContain('class="badge wait"');
    expect(run).toContain('class="badge run"');
    expect(css).toMatch(/\.badge\.wait\{background:var\(--info-bg\);color:var\(--info\)/);
  });
});

describe('M3 英文 360 下次按钮不截断', () => {
  test('两列 minmax(0,1fr)、按钮 min-width:0、文字在 span 里省略；≤339 仍单列（规则在后面）', () => {
    expect(css).toMatch(/\.acts\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
    expect(css).toMatch(/\.acts \.btn\{min-width:0\}/);
    expect(css).toMatch(/\.acts \.btn>span\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
    expect(css.lastIndexOf('.acts{grid-template-columns:1fr}')).toBeGreaterThan(css.indexOf('repeat(2,minmax(0,1fr))'));
    const html = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.html'), 'utf8');
    expect(html).toMatch(/id="pdfBtn"[^>]*><span data-i18n="popup_btn_pdf">/);
  });
});

describe('建议：后端标签字号 ≥12px', () => {
  test('.backend-label 12px，用 --text-2 而不是降低不透明度', () => {
    const m = css.match(/\.backend-label \{([^}]*)\}/);
    expect(m).toBeTruthy();
    const px = Number((m[1].match(/font-size:\s*(\d+)px/) || [])[1]);
    expect(px).toBeGreaterThanOrEqual(12);
    expect(m[1]).not.toMatch(/opacity/);
  });
});
