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
