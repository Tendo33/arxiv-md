// R4 设计验收：popup 版式（M3、M9）与建议项（待确认样式、后端标签字号）
import fs from 'fs';
import path from 'path';
import { translations } from '../src/config/locales';
import { parseHTML as __parseHTML } from 'linkedom';
// release-polish AR-04：createTaskRow 返回 DOM 节点，这里在 linkedom 文档里构建后取 outerHTML 再断言
const __doc = __parseHTML('<!doctype html><html><body></body></html>').document;
const rowHtml = (task) => require('../src/ui/popup/task-list').createTaskRow(task, __doc).outerHTML;

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
    const wait = rowHtml({ id: 'a', status: 'awaiting_consent', provider: 'paddleocr', paperInfo: { title: 'T' }, createdAt: Date.now() });
    const run = rowHtml({ id: 'b', status: 'processing', provider: 'paddleocr', paperInfo: { title: 'T' }, createdAt: Date.now() });
    expect(wait).toContain('class="badge wait"');
    expect(run).toContain('class="badge run"');
    expect(css).toMatch(/\.badge\.wait\{background:var\(--info-bg\);color:var\(--info\)/);
  });
});

describe('M3 英文 360 下次按钮不截断', () => {
  test('两列 minmax(0,1fr)、按钮 min-width:0、文字在 span 里省略；≤339 也保持双列（复审 P3③ / 设计 M1 去掉了单列规则）', () => {
    expect(css).toMatch(/\.acts\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
    expect(css).toMatch(/\.acts \.btn\{min-width:0\}/);
    expect(css).toMatch(/\.acts \.btn>span\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
    expect(css).not.toContain('.acts{grid-template-columns:1fr}');
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

describe('建议：失败原因直接显示在行内', () => {
  const { createTaskRow } = require('../src/ui/popup/task-list');
  test('failed 行带 .row-err（已转义），其他状态没有', () => {
    const html = rowHtml({ id: 'x', status: 'failed', error: 'Key <bad>', paperInfo: { title: 'T' }, provider: 'paddleocr' });
    expect(html).toMatch(/<span class="row-err">Key &lt;bad&gt;<\/span><\/div>$/);
    expect(rowHtml({ id: 'y', status: 'completed', zipUrl: 'https://a/b.zip', paperInfo: { title: 'T' } })).not.toMatch(/row-err/);
    expect(css).toMatch(/\.row\{flex-wrap:wrap;row-gap:2px\}/);
  });
});

describe('任务行在 320–375 英文下不横向溢出', () => {
  test('行允许换行，标题 flex-basis 为 0 且有最小宽度', () => {
    expect(css).toMatch(/\.row\{flex-wrap:wrap;row-gap:2px\}/);
    expect(css).toMatch(/\.row \.n\{flex:1 1 0;min-width:3em\}/);
  });
});
