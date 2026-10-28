// 复审 P2-A：Key 不跨设备同步。后端（sync 里的 pdfProvider）选过但本设备没有 Key 时，
// popup 打开时和点“PDF 解析”时都给同一句提示。
const fill = (s, label) => String(s || '').replace('{provider}', label);

/** 本设备缺 Key 的提示文字；不需要提示时返回 null */
export function keyHereMessage(active, tr, label) {
  if (!active || !active.keyMissingHere) return null;
  return { title: fill(tr.popup_key_here_title, label), hint: tr.popup_key_here_hint };
}

/** 刷新 #alertKey */
export function renderKeyHint(doc, active, tr, label) {
  const box = doc.getElementById('alertKey');
  if (!box) return;
  const msg = keyHereMessage(active, tr, label);
  box.classList.toggle('hidden', !msg);
  doc.getElementById('keyHereTitle').textContent = msg ? msg.title : '';
  doc.getElementById('keyHereHint').textContent = msg ? msg.hint : '';
}
