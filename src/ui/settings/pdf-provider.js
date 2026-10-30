// R4-14：设置页“PDF 解析”分组。依赖全部注入，便于在 linkedom 里测试。
// 1.2.2：所有权限安装时一次授予，选后端不再弹数据说明、不再申请 / 撤销权限，选中即保存。
import { shortErrorText } from '../popup/task-error-text';
import { STORAGE_KEYS, TASK_STATUS } from '@config/constants';

/** 与 background/paddle-origin-rule.js 的 PADDLE_ORIGIN_RULE_ID 相同（tests/reinit-check-p3-3 核对）；设置页只读规则，不写 */
export const UI_PADDLE_RULE_ID = 4001;
export const REINIT_CHECK_TIMEOUT_MS = 1500;

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
 * @param {{doc:Document, storage:any, registry:any, t:()=>Object, toast?:(msg:string,type?:string)=>void}} deps
 */
export function createPdfProviderSection({ doc, storage, registry, t, toast = () => {}, runtime = globalThis.chrome && globalThis.chrome.runtime, local = globalThis.chrome && globalThis.chrome.storage && globalThis.chrome.storage.local, seg, dnr = globalThis.chrome && globalThis.chrome.declarativeNetRequest }) {
  const $ = (id) => doc.getElementById(id);
  const segOf = (k, text) => { const r = seg ? seg(k, text) : [text]; return Array.isArray(r) ? r : [r]; };
  const state = { current: null };

  async function render() {
    const tr = t();
    const p = registry.get(state.current);
    const vars = { provider: p.label, host: hostOf(p) };
    setRadio(doc, state.current);
    $('providerKeyLabel').textContent = fmt(tr.pdf_key_label, vars);
    const link = $('getKeyLink');
    $('getKeyText').textContent = fmt(tr.pdf_get_key, vars);
    link.setAttribute('href', KEY_LINKS[p.id] || '#');
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

    // 审查员 P3：网络规则没装上（dnr_not_ready）时的恢复入口：重新载入扩展，让后台重新装规则
    const reinit = $('reinitBtn');
    if (reinit) { reinit.hidden = p.id !== 'paddleocr'; reinit.textContent = tr.pdf_reinit_btn; reinit.title = tr.pdf_reinit_hint; }
    const row = $('reinitRow');
    if (row) row.hidden = p.id !== 'paddleocr';
  }

  async function init() {
    state.current = await storage.getPdfProvider((id) => UI_PROVIDERS.includes(id) && registry.has(id));
    await render();
  }

  /** 单选卡片 change：选中即保存，不弹确认、不申请权限 */
  async function onSelect(nextId) {
    const next = registry.get(nextId);
    if (!next || nextId === state.current) return render();
    state.current = nextId;
    await storage.setPdfProvider(nextId);
    $('tokenStatus').style.display = 'none';
    toast(t().toast_saved, 'success');
    await render();
    return true;
  }

  /** dnr_not_ready 恢复（P3-3）：先只读核对规则；规则已在 → 提示已就绪、不重载；有任务在跑 → 不重载；否则重新载入扩展。不申请任何权限 */
  async function ruleReady() {
    if (!dnr || typeof dnr.getDynamicRules !== 'function') return false;
    try {
      const rules = await Promise.race([
        Promise.resolve(dnr.getDynamicRules()),
        new Promise((r) => setTimeout(() => r(null), REINIT_CHECK_TIMEOUT_MS)),
      ]);
      return Array.isArray(rules) && rules.some((x) => x && x.id === UI_PADDLE_RULE_ID);
    } catch (_) { return false; }
  }
  async function runningTasks() {
    if (!local || typeof local.get !== 'function') return 0;
    try {
      const r = await local.get(STORAGE_KEYS.TASKS);
      const list = (r && r[STORAGE_KEYS.TASKS]) || [];
      // 审查 P3-a：等待 reinit 的 PENDING 任务（带 dnrReinitWaitSince，见 parse-task-runner L-01）本身就在等重载，不算「在跑」，
      // 否则按钮提示忙、排队的重载又在等设置页关闭，两边互锁
      return (Array.isArray(list) ? list : []).filter((x) => x && (x.status === TASK_STATUS.PROCESSING
        || (x.status === TASK_STATUS.PENDING && x.dnrReinitWaitSince == null))).length;
    } catch (_) { return 0; }
  }
  async function onReinit() {
    const tr = t();
    const n = await runningTasks();
    if (n > 0) { toast(n === 1 ? tr.pdf_reinit_busy_one : fmt(tr.pdf_reinit_busy, { n }), 'error'); return 'busy'; }
    if (await ruleReady()) { toast(tr.pdf_reinit_ready, 'success'); return 'ready'; }
    if (runtime && typeof runtime.reload === 'function') { runtime.reload(); return 'reloaded'; }
    return 'unavailable';
  }

  /** 测试连接：PaddleOCR 是 GET 随机 jobId，不提交任务、不扣额度 */
  async function onTest() {
    const tr = t();
    const p = registry.get(state.current);
    const token = $('providerKey').value.trim();
    const status = $('tokenStatus');
    status.style.display = '';
    if (!token) { status.className = 'token-status error'; status.textContent = tr.token_empty_error; return { ok: false }; }
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
      if (ev.target && ev.target.name === 'pdfProvider' && ev.target.checked) onSelect(ev.target.value);
    });
    if ($('reinitBtn')) $('reinitBtn').addEventListener('click', () => { onReinit(); });
    $('testTokenBtn').addEventListener('click', () => { onTest(); });
  }

  return { init, render, bind, onSelect, onReinit, onTest, get current() { return state.current; } };
}
