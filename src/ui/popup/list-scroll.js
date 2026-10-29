// 设计附录 D6（AX-10）：任务列表「看得出能滚」
// - 列表被截时，max-height 停在被截那一行的一半（offsetTop + 高度/2），露出半行；
// - 能滚且没到底：加 .can-scroll（底部 sticky 渐隐，CSS 里画），到底加 .at-end；
// - 能滚时 tabindex=0，键盘可聚焦后用方向键滚，不能滚时去掉。

/** 重新计算 max-height；listEl 需 position:relative（offsetTop 以列表为参照）。 */
export function fitListToHalfRow(listEl) {
  listEl.style.maxHeight = '';
  const avail = listEl.clientHeight;
  if (!(listEl.scrollHeight > avail + 1)) return updateListScrollState(listEl);
  const rows = Array.from(listEl.children).filter((r) => r.offsetHeight > 0);
  let cut = null;
  for (const r of rows) { if (r.offsetTop < avail) cut = r; else break; }
  if (cut) listEl.style.maxHeight = `${Math.round(cut.offsetTop + cut.offsetHeight / 2)}px`;
  return updateListScrollState(listEl);
}

export function updateListScrollState(listEl) {
  const can = listEl.scrollHeight > listEl.clientHeight + 1;
  const atEnd = !can || listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 1;
  listEl.classList.toggle('can-scroll', can);
  listEl.classList.toggle('at-end', atEnd);
  if (can) listEl.setAttribute('tabindex', '0'); else listEl.removeAttribute('tabindex');
  return { can, atEnd };
}

export function bindListScroll(listEl, win = globalThis.window) {
  listEl.addEventListener('scroll', () => updateListScrollState(listEl), { passive: true });
  if (win && win.addEventListener) win.addEventListener('resize', () => fitListToHalfRow(listEl));
}
