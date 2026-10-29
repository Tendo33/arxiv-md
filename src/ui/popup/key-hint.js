// 复审 P2-A：Key 不跨设备同步。后端（sync 里的 pdfProvider）选过但本设备没有 Key 时，
// popup 打开时和点“PDF 解析”时都给同一句提示。
import { NW_ZH, setNwText } from '../settings/nw-segments';

const fill = (s, label) => String(s || '').replace('{provider}', label);

/** 本设备缺 Key 的提示文字；不需要提示时返回 null */
export function keyHereMessage(active, tr, label) {
  if (!active || !active.keyMissingHere) return null;
  return { title: fill(tr.popup_key_here_title, label), hint: tr.popup_key_here_hint };
}

/** 刷新 #alertKey */
export function renderKeyHint(doc, active, tr, label, lang = 'en') {
  const box = doc.getElementById('alertKey');
  if (!box) return;
  const msg = keyHereMessage(active, tr, label);
  box.classList.toggle('hidden', !msg);
  doc.getElementById('keyHereTitle').textContent = msg ? msg.title : '';
  setHintText(doc.getElementById('keyHereHint'), msg ? msg.hint : '', lang);
}

/** R09：zh 按短语 .nw 分段（手工表优先，见 nw-segments.js）；popup 打开时和点「PDF 解析」时共用 */
export function setHintText(el, hint, lang) {
  const key = Object.keys(NW_ZH).find((k) => NW_ZH[k].join('') === hint) || '';
  setNwText(el, key, hint || '', lang);
}
