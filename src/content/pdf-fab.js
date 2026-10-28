// A3-1：PDF 页悬浮转换按钮（样式取自 ui-v2 的 .fab，arXiv 主色）。放在 Shadow DOM 里，避免和 PDF 查看器互相影响。
const CSS = `
:host{all:initial}
.fab{position:fixed;right:24px;bottom:24px;z-index:2147483646;width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;
  background:var(--brand);color:var(--brand-on);box-shadow:0 4px 12px rgb(0 0 0/.12);cursor:pointer;font:700 14px/1 system-ui,-apple-system,"Segoe UI",sans-serif;
  --brand:#b31b1b;--brand-on:#fff;--success:#0f7a3d;--danger:#b42318;transition:transform .15s ease}
@media (prefers-color-scheme:dark){.fab{--brand:#f87171;--brand-on:#1b0606;--success:#4ade80;--danger:#f87171;box-shadow:0 4px 12px rgb(0 0 0/.5)}}
.fab:hover{transform:translateY(-2px)}
.fab:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.fab .ring{position:absolute;inset:-4px;border-radius:50%;border:3px solid transparent;pointer-events:none}
.fab.run .ring{border-color:var(--brand) transparent transparent transparent;animation:spin 1s linear infinite}
.fab.ok{background:var(--success)}
.fab.err{background:var(--danger)}
.fab[aria-busy=true]{cursor:progress}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.fab{transition:none}.fab:hover{transform:none}.fab.run .ring{animation:none;border-color:var(--brand)}}
`;
const ICON = {
  idle: 'M↓',
  run: 'M↓',
  ok: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>',
  err: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 7v6M12 16.5v.5"/></svg>',
};

/**
 * @param {Document} doc
 * @param {{labels:{idle:string,run:string,ok:string,err:string}, onClick:()=>void}} opts
 */
export function mountPdfFab(doc, { labels, onClick }) {
  const host = doc.createElement('arxiv-md-fab');
  host.id = 'arxiv-md-pdf-fab';
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = CSS;
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'fab';
  root.append(style, btn);
  let state = 'idle';
  let timer = null;

  const setState = (next) => {
    state = next;
    btn.className = next === 'idle' ? 'fab' : `fab ${next}`;
    btn.innerHTML = `<span class="ring"></span>${ICON[next] || ICON.idle}`;
    btn.setAttribute('aria-label', labels[next] || labels.idle);
    btn.title = labels[next] || labels.idle;
    btn.setAttribute('aria-busy', next === 'run' ? 'true' : 'false');
    if (timer) { clearTimeout(timer); timer = null; }
    if (next === 'ok' || next === 'err') timer = setTimeout(() => setState('idle'), next === 'ok' ? 4000 : 6000);
  };
  btn.addEventListener('click', () => {
    if (state === 'run') return;
    onClick();
  });
  setState('idle');
  (doc.body || doc.documentElement).appendChild(host);
  return { host, button: btn, setState, getState: () => state, remove: () => host.remove() };
}
