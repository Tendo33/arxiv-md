/* eslint-env node */
/* eslint-disable no-console */
// 设计附录 D（popup 部分）回归 e2e：干净 profile 加载 dist，当前标签页模拟成 arXiv abs 页。
// AX-03：7 个状态 × zh/en × 亮/暗 × 320/360，主按钮 top 相对空闲态位移必须为 0。
// 运行条件同 e2e-popup-tasklist.js（CHROME_PATH、playwright）。E2E_ADDENDUM_OUT=<file> 写出测量 JSON。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
function loadPlaywright() {
  for (const d of [root, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean)) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  console.error('e2e addendum: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}

const STATES = ['progress', 'saved', 'submitted', 'needkey', 'failed', 'cancelled', 'notice'];
const SECTIONS = {};

async function openPopup(ctx, id, w, theme) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: 600 });
  await p.emulateMedia({ colorScheme: theme });
  await p.addInitScript(() => { chrome.tabs.query = async () => [{ id: 999999, url: 'https://arxiv.org/abs/1706.03762', title: '[1706.03762] Attention Is All You Need' }]; });
  await p.goto(`chrome-extension://${id}/popup.html`);
  await p.evaluate((s) => document.documentElement.setAttribute('data-theme', s), theme);
  await p.waitForSelector('#taskList .row', { timeout: 10000 });
  await p.waitForTimeout(500);
  return p;
}

// AX-03：直接切 DOM 到各个状态（文案用当前语言最长的那条），量主按钮位置
SECTIONS.shift = async (p) => p.evaluate((STATES) => {
  const $ = (i) => document.getElementById(i);
  const top = () => $('exportBtn').getBoundingClientRect().top;
  const all = ['alertOk', 'alertErr', 'alertKey'];
  const reset = () => { all.forEach((i) => $(i).classList.add('hidden')); $('ctxProg').classList.add('hidden'); };
  reset();
  const base = top();
  const out = {};
  const long = 'Converting this paper — the server is processing a long request, please wait';
  for (const s of STATES) {
    reset();
    if (s === 'progress') $('ctxProg').classList.remove('hidden');
    else if (s === 'saved' || s === 'submitted') { $('okTitle').textContent = s; $('okFile').textContent = ` · ${long}`; $('alertOk').classList.remove('hidden'); }
    else if (s === 'needkey' || s === 'notice') { $('keyHereTitle').textContent = s; $('keyHereHint').textContent = long; $('alertKey').classList.remove('hidden'); }
    else { $('errTitle').textContent = s; $('errHint').textContent = ` ${long}`; $('alertErr').classList.remove('hidden'); }
    out[s] = Math.round((top() - base) * 10) / 10;
  }
  reset();
  // ctxMeta 不能被裁（#ctxCard flex:none）
  const meta = $('ctxMeta'); const card = $('ctxCard');
  out.metaClipped = meta.getBoundingClientRect().bottom > card.getBoundingClientRect().bottom + 0.5;
  return out;
}, STATES);
const checkShift = (m) => STATES.every((s) => m[s] === 0) && !m.metaClipped;

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e addendum: CHROME_PATH 未设置或不存在'); process.exit(2); }
  const out = {};
  let fail = 0;
  for (const lang of ['zh', 'en']) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-addendum-'));
    const ctx = await chromium.launchPersistentContext(prof, { headless: false, executablePath, args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
    try {
      const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
      const id = sw.url().split('/')[2];
      await sw.evaluate(async (l) => {
        const n = Date.now();
        const tasks = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, status: i % 2 ? 'failed' : 'completed', progress: 100, createdAt: n - (i + 1) * 60e3, provider: i % 3 ? 'mineru' : 'paddleocr', zipUrl: i % 2 ? undefined : 'https://example.com/a.zip', errorCode: i % 2 ? 'QUOTA_EXCEEDED' : undefined, paperInfo: { arxivId: `2401.0000${i}`, title: `Paper ${i} with a reasonably long title for wrapping` } }));
        await chrome.storage.sync.set({ language: l, pdfProvider: 'mineru' });
        await chrome.storage.local.set({ providerKeys: { mineru: 'fixture-not-a-real-key' }, 'disclosureAck.mineru': 1, mineruTasks: tasks });
      }, lang);
      for (const theme of ['light', 'dark']) {
        for (const w of [320, 360]) {
          const p = await openPopup(ctx, id, w, theme);
          for (const [name, fn] of Object.entries(SECTIONS)) {
            const m = await fn(p, { lang, theme, w });
            const ok = { shift: checkShift }[name] ? { shift: checkShift }[name](m) : m.ok;
            const key = `${name}-${lang}-${theme}-${w}`;
            out[key] = { ...m, ok };
            console.log(`${ok ? 'PASS' : 'FAIL'} ${key} ${JSON.stringify(m)}`);
            if (!ok) fail++;
          }
          await p.close();
        }
      }
    } finally {
      await ctx.close();
      fs.rmSync(prof, { recursive: true, force: true });
    }
  }
  if (process.env.E2E_ADDENDUM_OUT) fs.writeFileSync(process.env.E2E_ADDENDUM_OUT, JSON.stringify(out, null, 2));
  console.log(fail ? `e2e addendum: ${fail} FAIL` : 'e2e addendum: PASS');
  process.exit(fail ? 1 : 0);
})();
