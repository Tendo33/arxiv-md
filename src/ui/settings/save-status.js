// design-abs-buttons-2026-10-29 B7：保存结果显示在操作栏的 .autosave-note 里，不再用浮层 toast。
// 成功：「✓ 已保存」2 秒后恢复「更改会自动保存」；失败：.error 常驻，并在单独的 role=alert 节点播报。
import { svg } from '@utils/dom';

const CHECK = ['svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'aria-hidden': 'true' }, [
  ['polyline', { points: '20 6 9 17 4 12' }],
]];
const RESTORE_MS = 2000;

/** @param {{doc:Document, t:()=>Object, setTimer?:Function, clearTimer?:Function}} deps */
export function createSaveStatus({ doc, t, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  const idle = (n) => {
    n.className = 'autosave-note';
    const span = doc.createElement('span');
    span.setAttribute('data-i18n', 'autosave_note');
    span.textContent = t().autosave_note;
    n.replaceChildren(span);
  };
  return function showSaveStatus(message, type = 'success') {
    const n = doc.getElementById('saveStatus');
    const alertEl = doc.getElementById('saveAlert');
    if (!n) return;
    clearTimer(timer);
    timer = null;
    const text = String(message).replace(/^[✅❌✓]\s*/u, '');
    n.classList.toggle('saved', type === 'success');
    n.classList.toggle('error', type === 'error');
    if (type === 'success') n.replaceChildren(svg(doc, CHECK), doc.createTextNode(text));
    else n.replaceChildren(doc.createTextNode(text));
    if (alertEl) alertEl.textContent = type === 'error' ? text : '';
    if (type !== 'error') timer = setTimer(() => { idle(n); timer = null; }, RESTORE_MS);
  };
}
