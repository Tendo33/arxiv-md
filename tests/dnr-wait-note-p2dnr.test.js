import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales.js';
import { createTaskRow, setTaskListLanguage } from '../src/ui/popup/task-list.js';
import { TASK_STATUS } from '../src/config/constants.js';

const { document } = parseHTML('<!doctype html><html><body></body></html>');

describe('QA P2-DNR：等 DNR 重载的任务不再静默 0%', () => {
  test('zh/en 都有文案', () => {
    expect(translations.en.popup_note_dnr_wait).toMatch(/Close this popup and the settings page/);
    expect(translations.zh.popup_note_dnr_wait).toMatch(/关闭此弹窗和设置页/);
  });
  test.each(['en','zh'])('%s：带 dnrReinitWaitSince 的 PENDING 行显示说明，普通 PENDING 不显示', (lang) => {
    setTaskListLanguage(lang);
    const w = createTaskRow({ id: 'a', status: TASK_STATUS.PENDING, dnrReinitWaitSince: 1, paperInfo: { title: 'x' } }, document);
    const n = w.querySelector('.row-note');
    expect(n && n.textContent).toBe(translations[lang].popup_note_dnr_wait);
    expect(n.getAttribute('role')).toBe('status');
    const p = createTaskRow({ id: 'b', status: TASK_STATUS.PENDING, paperInfo: { title: 'x' } }, document);
    expect(p.querySelector('.row-note')).toBeNull();
  });
});
