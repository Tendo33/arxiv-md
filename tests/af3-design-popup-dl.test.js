/**
 * AF3 设计验收：英文弹窗窄宽（≤379px，含 360）时 Download 只显示图标，保留 aria-label
 */
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'popup', 'popup.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'popup', 'popup.js'), 'utf8');
const list = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'popup', 'task-list.js'), 'utf8');

test('英文 ≤379px 隐藏 Download 文字', () => {
  expect(css).toMatch(/@media \(max-width:379px\)\{[^\n]*html\[lang="en"\] \.row \.row-act \.btn-dl \.lbl\{display:none\}/);
});

test('Download 按钮仍带 aria-label/title，popup 按语言设置 html lang', () => {
  expect(list).toMatch(/el\(doc, 'button', \{ class: 'btn btn-ghost btn-dl', 'data-action': 'download', 'data-url': zipUrl, title: t\.popup_action_download, 'aria-label': t\.popup_action_download \},\s*\[downloadIcon\(doc\), el\(doc, 'span', \{ class: 'lbl' \}/);
  expect(js).toMatch(/document\.documentElement\.lang = currentLang === 'zh' \? 'zh-CN' : 'en'/);
});
