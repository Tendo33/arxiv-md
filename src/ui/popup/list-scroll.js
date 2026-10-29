// 设计附录 D6（AX-10）：任务列表「看得出能滚」
// - 列表被截时，max-height 停在被截那一行的一半（offsetTop + 高度/2），露出半行；
// - 能滚且没到底：加 .can-scroll（底部 sticky 渐隐，CSS 里画），到底加 .at-end；
// - 能滚时 tabindex=0，键盘可聚焦后用方向键滚，不能滚时去掉。

/** 重新计算 max-height；listEl 需 position:relative（offsetTop 以列表为参照）。 */
export function fitListToHalfRow(listEl) {
  listEl.style.maxHeight = '';
  listEl.style.minHeight = '';
  const rows = Array.from(listEl.children).filter((r) => r.offsetHeight > 0);
  // 设计 Q1 裁定：列表至少露出 2 整行 + 0.5 行（320 下行变高、有提示卡时也一样）；超出部分由 .body 滚动
  const mid = (r) => r.offsetTop + r.offsetHeight / 2;
  const minH = rows.length >= 3 ? Math.round(mid(rows[2])) : 0;
  if (minH) listEl.style.minHeight = `${minH}px`;
  const avail = listEl.clientHeight;
  if (!(listEl.scrollHeight > avail + 1)) return updateListScrollState(listEl);
  // 设计复验 15fe0f9 必须改 6：被截行要能露出半行（中线在可用高度内），否则 .pop 的 max-height 会把半行再压掉
  // 审查 P3-2：clientHeight 不含边框、offsetTop 从边框内算起，实测差约 2px，第 3 行中线常被判成「超出」、cut 退到第 2 行，
  // max-height 比 min-height 还小（只靠 min 压过 max 才显示对）。有下限时 cut 至少取第 3 行，max-height 不小于 min-height。
  let cut = minH ? rows[2] : null;
  for (let i = minH ? 3 : 0; i < rows.length && mid(rows[i]) <= avail; i++) cut = rows[i];
  if (cut) listEl.style.maxHeight = `${Math.max(minH, Math.round(mid(cut)))}px`;
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

/** 必须改 6：状态区（提示卡出现 / 消失）高度变化后重算列表高度 */
export function refitOnResize(zoneEl, listEl, win = globalThis.window) {
  const RO = win && win.ResizeObserver;
  if (!RO || !zoneEl) return null;
  const ro = new RO(() => fitListToHalfRow(listEl));
  ro.observe(zoneEl);
  return ro;
}
