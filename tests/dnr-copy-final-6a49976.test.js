// 设计复验 6a49976 裁定 3：P2-DNR 文案定稿 + zh .nw 分段（不拆「展|会」「动|重」），样式中性
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales.js';
import { createTaskRow, setTaskListLanguage } from '../src/ui/popup/task-list.js';
import { NW_ZH } from '../src/ui/settings/nw-segments.js';
import { TASK_STATUS } from '../src/config/constants.js';

const { document } = parseHTML('<!doctype html><html><body></body></html>');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
const row = () => createTaskRow({ id: 'a', status: TASK_STATUS.PENDING, dnrReinitWaitSince: 1, paperInfo: { title: 'x' } }, document).querySelector('.row-note');

test('定稿文案逐字一致', () => {
  expect(translations.zh.popup_note_dnr_wait).toBe('正在完成网络设置。关闭此弹窗和设置页后，扩展会自动重启一次并继续。');
  expect(translations.en.popup_note_dnr_wait).toBe('Finishing network setup. Close this popup and the settings page, and the extension will restart once and continue.');
  expect(NW_ZH.popup_note_dnr_wait).toEqual(['正在完成网络设置。', '关闭此弹窗和设置页后，', '扩展会自动重启一次', '并继续。']);
  expect(NW_ZH.popup_note_dnr_wait.join('')).toBe(translations.zh.popup_note_dnr_wait);
});
test('zh：4 个 .nw 片段，内容为分段表', () => {
  setTaskListLanguage('zh');
  const n = row();
  expect([...n.querySelectorAll('.nw')].map((s) => s.textContent)).toEqual(NW_ZH.popup_note_dnr_wait);
  expect(n.textContent).toBe(translations.zh.popup_note_dnr_wait);
  expect(n.getAttribute('role')).toBe('status');
});
test('en：纯文本，不加 .nw', () => {
  setTaskListLanguage('en');
  const n = row();
  expect(n.querySelectorAll('.nw').length).toBe(0);
  expect(n.textContent).toBe(translations.en.popup_note_dnr_wait);
});
test('样式：.row-note 中性 --text-2 12/18，.nw 不换行', () => {
  expect(css).toMatch(/\.row \.row-note\{[^}]*font-size:12px;line-height:18px;color:var\(--text-2\)[;}]/);
  expect(css).toMatch(/\.row \.row-note \.nw\{white-space:nowrap\}/);
});
