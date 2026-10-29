// R4-14：设置页“PDF 解析”分组。依赖全部注入，便于在 linkedom 里测试。
// 权限申请只发生在下拉框 change / 按钮 click（用户手势）里；用户拒绝 → 下拉框回到原来的后端。
import { requestProviderPermission, hasProviderPermission, removeProviderPermission, canRevoke, permissionsFor } from '@pdf-core/permissions';
import { shortErrorText } from '../popup/task-error-text';

/** 本轮 UI 可选的后端（本地服务本轮隐藏，只预留接口） */
export const UI_PROVIDERS = ['paddleocr', 'mineru'];
export const KEY_LINKS = {
  paddleocr: 'https://aistudio.baidu.com/account/accessToken',
  mineru: 'https://mineru.net/apiManage/token',
};

const fmt = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
// 浏览器里直接设 value；linkedom（测试）的 select.value 只有 getter，退回改 option 的 selected 属性
function setSelect(sel, v) {
  try { sel.value = v; if (sel.value === v) return; } catch { /* fallthrough */ }
  sel.querySelectorAll('option').forEach((o) => { if (o.value === v) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
}

const hostOf = (provider) => {
  const o = (provider.hosts || [])[0] || '';
  return o.replace(/^https?:\/\//, '').replace(/\/\*$/, '');
};

/**
 * @param {{doc:Document, storage:any, permissions:any, registry:any, t:()=>Object, toast?:(msg:string,type?:string)=>void}} deps
 */
export function createPdfProviderSection({ doc, storage, permissions, registry, t, toast = () => {} }) {
  const $ = (id) => doc.getElementById(id);
  const state = { current: null, denied: null };

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
    setSelect($('pdfProvider'), state.current);
    $('pdfProviderDesc').textContent = tr[`pdf_desc_${p.id}`] || '';
    $('providerKeyLabel').textContent = fmt(tr.pdf_key_label, vars);
    const link = $('getKeyLink');
    link.textContent = fmt(tr.pdf_get_key, vars);
    link.setAttribute('href', KEY_LINKS[p.id] || '#');
    const key = $('providerKey');
    key.dataset.provider = p.id;
    key.value = (await storage.getProviderKey(p.id)) || '';
    // 复审 P2-A：后端是选过的（sync 带过来）但本设备没有 Key → 提示在本设备重新填写
    const hint = $('keyHereHint');
    if (hint) {
      const chosen = storage.getChosenPdfProvider ? await storage.getChosenPdfProvider().catch(() => null) : null;
      hint.hidden = !(chosen === p.id && !key.value);
      hint.textContent = hint.hidden ? '' : fmt(tr.pdf_key_here, vars);
    }

    const needs = permissionsFor(p).origins.length > 0;
    const granted = await hasProviderPermission(permissions, p);
    $('permissionRow').hidden = !needs;
    $('permissionStatus').textContent = needs ? fmt(granted ? tr.pdf_perm_granted : tr.pdf_perm_missing, vars) : '';
    $('grantPermissionBtn').hidden = !needs || granted;
    $('grantPermissionBtn').textContent = tr.pdf_grant_btn;

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
    await render();
  }

  /** 下拉框 change（用户手势） */
  async function onSelect(nextId) {
    const prev = state.current;
    const next = registry.get(nextId);
    if (!next || nextId === prev) return render();
    const ok = await requestProviderPermission(permissions, next);
    const tr = t();
    if (!ok) {
      setSelect($('pdfProvider'), prev);
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
    status.style.display = 'block';
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
        status.append(' ', a);
      }
    }
    return r;
  }

  function bind() {
    $('pdfProvider').addEventListener('change', (ev) => { onSelect(ev.target.value); });
    $('grantPermissionBtn').addEventListener('click', () => { onGrant(); });
    $('revokePermissionBtn').addEventListener('click', () => { onRevoke(); });
    $('testTokenBtn').addEventListener('click', () => { onTest(); });
  }

  return { init, render, bind, onSelect, onGrant, onRevoke, onTest, get current() { return state.current; } };
}
