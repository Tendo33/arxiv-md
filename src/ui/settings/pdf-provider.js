// R4-14：设置页“PDF 解析”分组。依赖全部注入，便于在 linkedom 里测试。
// 权限申请只发生在下拉框 change / 按钮 click（用户手势）里；用户拒绝 → 下拉框回到原来的后端。
import { requestProviderPermission, hasProviderPermission, removeProviderPermission, canRevoke, permissionsFor } from '@pdf-core/permissions';
import { shortErrorText } from '../popup/task-error-text';
import { isDisclosureAcked, ackDisclosure, needsDisclosure, parseDisclosureHash } from '@utils/disclosure-ack';
import { buildDisclosurePanel } from './disclosure';

/** 本轮 UI 可选的后端（本地服务本轮隐藏，只预留接口） */
export const UI_PROVIDERS = ['paddleocr', 'mineru'];
export const KEY_LINKS = {
  paddleocr: 'https://aistudio.baidu.com/account/accessToken',
  mineru: 'https://mineru.net/apiManage/token',
};

const fmt = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
// design-abs-buttons-2026-10-29 R01：后端选择改为 fieldset 单选卡片（不再是原生 select）
const radios = (doc) => [...doc.querySelectorAll('input[name="pdfProvider"]')];
export function checkedProvider(doc) {
  const r = radios(doc).find((x) => x.checked);
  return r ? r.value : null;
}
function setRadio(doc, v) {
  for (const r of radios(doc)) {
    r.checked = r.value === v;
    if (r.checked) r.setAttribute('checked', ''); else r.removeAttribute('checked');
  }
}

const hostOf = (provider) => {
  const o = (provider.hosts || [])[0] || '';
  return o.replace(/^https?:\/\//, '').replace(/\/\*$/, '');
};

/**
 * @param {{doc:Document, storage:any, permissions:any, registry:any, t:()=>Object, toast?:(msg:string,type?:string)=>void}} deps
 */
export function createPdfProviderSection({ doc, storage, permissions, registry, t, toast = () => {}, runtime = globalThis.chrome && globalThis.chrome.runtime, local = globalThis.chrome && globalThis.chrome.storage && globalThis.chrome.storage.local, seg, location: loc = globalThis.location }) {
  const $ = (id) => doc.getElementById(id);
  const segOf = (k, text) => { const r = seg ? seg(k, text) : [text]; return Array.isArray(r) ? r : [r]; };
  const state = { current: null, denied: null, acked: {}, pending: null, fromHash: null };

  // 撤销按钮：只要还留着任一项（部分授权也算）就显示
  async function hasAnyGrant(p) {
    const q = permissionsFor(p);
    for (const o of q.origins) {
      try { if (await permissions.contains({ origins: [o] })) return true; } catch { /* 继续看下一项 */ }
    }
    return false;
  }

  async function render() {
    state.denied = null;
    const tr = t();
    const p = registry.get(state.current);
    const vars = { provider: p.label, host: hostOf(p) };
    if (!state.pending) setRadio(doc, state.current);
    $('providerKeyLabel').textContent = fmt(tr.pdf_key_label, vars);
    const link = $('getKeyLink');
    $('getKeyText').textContent = fmt(tr.pdf_get_key, vars);
    link.setAttribute('href', KEY_LINKS[p.id] || '#');
    if (state.pending) refreshPanelText();
    const key = $('providerKey');
    key.dataset.provider = p.id;
    key.value = (await storage.getProviderKey(p.id)) || '';
    // 复审 P2-A：后端是选过的（sync 带过来）但本设备没有 Key → 提示在本设备重新填写
    const hint = $('keyHereHint');
    if (hint) {
      const chosen = storage.getChosenPdfProvider ? await storage.getChosenPdfProvider().catch(() => null) : null;
      hint.hidden = !(chosen === p.id && !key.value);
      if (hint.hidden) hint.textContent = '';
      else hint.replaceChildren(...segOf('pdf_key_here', fmt(tr.pdf_key_here, vars)));
    }

    const needs = permissionsFor(p).origins.length > 0;
    const granted = await hasProviderPermission(permissions, p);
    $('permissionRow').hidden = !needs;
    $('permissionStatus').replaceChildren(...(needs ? segOf('pdf_perm', fmt(granted ? tr.pdf_perm_granted : tr.pdf_perm_missing, vars)) : []));
    $('grantPermissionBtn').hidden = !needs || granted;
    $('grantPermissionBtn').textContent = tr.pdf_grant_btn;
    // 审查员 P3：权限已授予但网络规则没装上（dnr_not_ready）时的恢复入口：重新载入扩展，让后台带着已授予的权限重新启动
    const reinit = $('reinitBtn');
    if (reinit) { reinit.hidden = !(needs && granted && p.id === 'paddleocr'); reinit.textContent = tr.pdf_reinit_btn; reinit.title = tr.pdf_reinit_hint; }

    // 切换后端后，旧后端还有可撤销的权限 → 显示“撤销”
    const stale = [];
    for (const id of UI_PROVIDERS) {
      const other = registry.get(id);
      if (id !== p.id && other && canRevoke(other) && (await hasAnyGrant(other))) stale.push(other);
    }
    $('revokeRow').hidden = stale.length === 0;
    $('revokeText').textContent = stale.length ? fmt(tr.pdf_revoke_text, { provider: stale[0].label, host: hostOf(stale[0]) }) : '';
    $('revokePermissionBtn').dataset.provider = stale.length ? stale[0].id : '';
  }

  async function init() {
    state.current = await storage.getPdfProvider((id) => UI_PROVIDERS.includes(id) && registry.has(id));
    for (const id of UI_PROVIDERS) state.acked[id] = await isDisclosureAcked(id, local);
    await render();
    // C10：从摘要页 / popup / 右键菜单跳过来（#disclose=<provider>）→ 直接打开该后端的数据说明
    const want = parseDisclosureHash(loc && loc.hash);
    if (want && !state.acked[want]) {
      state.fromHash = want;
      openDisclosure(want);
    }
  }

  // ---- 附录 C：数据说明面板 ----
  function closePanel() {
    const old = $('pdPanel');
    if (old) old.remove();
    state.pending = null;
  }

  function refreshPanelText() {
    const id = state.pending;
    closePanel();
    openDisclosure(id, { focus: false });
  }

  /** 设计验收 30a6e1b #6：确认后的提示行（✓ 前缀），在卡片组下方 */
  function showConfirmed(text) {
    const el = $('pdConfirmed');
    if (!el) return;
    el.textContent = `✓ ${text}`;
    el.hidden = false;
  }
  function hideConfirmed() {
    const el = $('pdConfirmed');
    if (el) { el.hidden = true; el.textContent = ''; }
  }

  function openDisclosure(id, { focus = true } = {}) {
    closePanel();
    hideConfirmed();
    const p = registry.get(id);
    const tr = t();
    const { panel, title, ok, cancel } = buildDisclosurePanel(doc, tr, p, segOf);
    state.pending = id;
    setRadio(doc, id); // 被点的卡片保持「已选」外观，面板在它下方
    const card = doc.querySelector(`.provider-card[data-provider="${id}"]`);
    card.after(panel);
    ok.addEventListener('click', () => { onAgree(id); });
    cancel.addEventListener('click', () => { onCancelDisclosure(); });
    panel.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); onCancelDisclosure(); } });
    const live = $('pdLive');
    if (live) live.textContent = fmt(tr.pdf_disc_live, { provider: p.label });
    if (focus && typeof title.focus === 'function') title.focus();
    return panel;
  }

  function onCancelDisclosure() {
    closePanel();
    state.fromHash = null;
    setRadio(doc, state.current);
    const r = radios(doc).find((x) => x.value === state.current);
    if (r && typeof r.focus === 'function') r.focus();
    const live = $('pdLive');
    if (live) live.textContent = '';
  }

  /**
   * 「同意并使用」（用户手势）：写确认记录、切换后端，并在同一个手势里申请权限。
   * 存储写入不 await，保证 permissions.request 仍在手势内。用户拒绝授权时后端照样保存，权限行显示「需要授权访问」。
   */
  async function onAgree(id) {
    const p = registry.get(id);
    const fromHash = state.fromHash === id;
    closePanel();
    state.fromHash = null;
    state.acked[id] = true;
    const writes = [ackDisclosure(id, local), storage.setPdfProvider(id)];
    state.current = id;
    setRadio(doc, id);
    const granted = await requestProviderPermission(permissions, p);
    await Promise.all(writes.map((w) => Promise.resolve(w).catch(() => {})));
    $('permissionRow').classList.remove('denied');
    $('tokenStatus').style.display = 'none';
    const tr = t();
    await render();
    showConfirmed(fromHash ? tr.pdf_disc_confirmed : tr.toast_saved); // 设计验收 30a6e1b #6：卡片下方内联，不用 toast
    return granted;
  }

  /** 单选卡片 change（用户手势）：未确认过的后端先显示数据说明；已确认的走原来的授权 → 保存流程 */
  function onPick(id) {
    if (!registry.has(id)) return render();
    if (state.pending && state.pending !== id) closePanel();
    if (id === state.current && !state.pending) return render();
    if (id === state.current) { onCancelDisclosure(); return null; }
    if (needsDisclosure(id) && !state.acked[id]) return openDisclosure(id);
    return onSelect(id);
  }

  /** 下拉框 change（用户手势） */
  async function onSelect(nextId) {
    const prev = state.current;
    const next = registry.get(nextId);
    if (!next || nextId === prev) return render();
    const ok = await requestProviderPermission(permissions, next);
    const tr = t();
    if (!ok) {
      setRadio(doc, prev);
      // 设计验收 M6：拒绝的说明留在权限行里（不随 toast 消失），附「重新授权」，并滚到可见处
      state.denied = nextId;
      const msg = fmt(tr.pdf_perm_denied, { host: hostOf(next), provider: registry.get(prev).label, next: next.label });
      const row = $('permissionRow');
      row.hidden = false;
      row.classList.add('denied');
      $('permissionStatus').textContent = msg;
      const btn = $('grantPermissionBtn');
      btn.textContent = tr.pdf_regrant_btn;
      btn.hidden = false;
      if (typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'center' });
      toast(msg, 'error');
      return false;
    }
    state.current = nextId;
    $('permissionRow').classList.remove('denied');
    await storage.setPdfProvider(nextId);
    $('tokenStatus').style.display = 'none';
    toast(tr.toast_saved, 'success');
    await render();
    return true;
  }

  async function onGrant() {
    if (state.denied) {
      const id = state.denied;
      const ok = await onSelect(id);
      if (ok) $('permissionRow').classList.remove('denied');
      return ok;
    }
    const p = registry.get(state.current);
    const ok = await requestProviderPermission(permissions, p);
    if (!ok) toast(fmt(t().pdf_perm_missing, { provider: p.label, host: hostOf(p) }), 'error');
    await render();
    return ok;
  }

  /** dnr_not_ready 恢复：重新载入扩展（任务记录在 storage 里，载入后可在 popup 重试）。不申请任何权限 */
  function onReinit() {
    if (runtime && typeof runtime.reload === 'function') { runtime.reload(); return true; }
    return false;
  }

  async function onRevoke() {
    const id = $('revokePermissionBtn').dataset.provider;
    const p = id && registry.get(id);
    if (!p) return false;
    const ok = await removeProviderPermission(permissions, p);
    if (ok) toast(fmt(t().pdf_revoked, { host: hostOf(p) }), 'success');
    await render();
    return ok;
  }

  /** 测试连接：PaddleOCR 是 GET 随机 jobId，不提交任务、不扣额度 */
  async function onTest() {
    const tr = t();
    const p = registry.get(state.current);
    const token = $('providerKey').value.trim();
    const status = $('tokenStatus');
    status.style.display = '';
    if (!token) { status.className = 'token-status error'; status.textContent = tr.token_empty_error; return { ok: false }; }
    if (!(await hasProviderPermission(permissions, p))) {
      status.className = 'token-status error';
      status.textContent = fmt(tr.err_PERMISSION_MISSING, { host: hostOf(p), provider: p.label });
      return { ok: false };
    }
    status.className = 'token-status testing';
    status.textContent = tr.token_testing;
    const r = p.testConnection ? await p.testConnection({ token }, {}) : { ok: true };
    if (r.ok) {
      status.className = 'token-status success'; status.textContent = tr.token_api_valid;
    } else {
      const e = r.error || {};
      // rp2b（设计 ①②）：「{provider} 解析失败：」前缀已带后端名，{reason} 用不带后端名的短文案
      // 带 code 的错误 message 是 "paddleocr: PROVIDER_FAILED" 这类原始码，只进日志，不给用户看
      const reason = shortErrorText({ code: e.code, reason: e.reason, host: hostOf(p) }, tr) || (e.code ? '' : e.message) || tr.err_short_failed_plain;
      status.className = 'token-status error';
      // 设计建议：已经填了 Key 时不说「未填写」；失败一律带 ❌，Key 问题附「获取 Key」链接
      const msg = e.code === 'AUTH_INVALID'
        ? tr.token_api_invalid
        : fmt(tr[`err_${e.code}`] || tr.token_test_error, { provider: p.label, host: hostOf(p), reason });
      status.textContent = msg.startsWith('❌') ? msg : `❌ ${msg}`;
      if (e.code === 'AUTH_INVALID') {
        const a = doc.createElement('a');
        a.href = KEY_LINKS[p.id] || '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'token-status-link';
        a.textContent = fmt(tr.pdf_get_key, { provider: p.label });
        const nt = doc.createElement('span');
        nt.className = 'sr-only';
        nt.textContent = tr.link_new_tab;
        a.append(nt);
        status.append(' ', a);
      }
    }
    return r;
  }

  function bind() {
    $('pdfProviderGroup').addEventListener('change', (ev) => {
      if (ev.target && ev.target.name === 'pdfProvider' && ev.target.checked) onPick(ev.target.value);
    });
    $('grantPermissionBtn').addEventListener('click', () => { onGrant(); });
    if ($('reinitBtn')) $('reinitBtn').addEventListener('click', () => { onReinit(); });
    $('revokePermissionBtn').addEventListener('click', () => { onRevoke(); });
    $('testTokenBtn').addEventListener('click', () => { onTest(); });
  }

  return { init, render, bind, onSelect, onPick, onAgree, onCancelDisclosure, openDisclosure, onGrant, onRevoke, onReinit, onTest, get current() { return state.current; }, get pending() { return state.pending; } };
}
