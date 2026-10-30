/* eslint-env node */
/* eslint-disable no-console */
// abs-buttons v2 回归 e2e（design-abs-buttons-2026-10-29 R05）：干净 profile 加载 dist，
// 把 https://arxiv.org/abs/2401.00001 路由到离线 fixture（tests/fixtures/abs），其余请求一律拦下并计数。
// R05：状态行在每种状态（进行中 / 已提交 / 完成 / 失败 / 警告 / 已取消）下显示时，按钮行位移必须为 0。
// C10（1.2.2 零确认）：有 Key 时点按钮直接提交解析任务，不打开设置页、不弹数据说明、不出中性拦截提示，按钮不位移。
// 运行：E2E_PLAYWRIGHT_DIR=… CHROME_PATH=… xvfb-run -a node scripts/e2e-abs-buttons.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const dist = process.env.E2E_DIST || path.join(root, 'dist');
const ABS = 'https://arxiv.org/abs/2401.00001';
const FIXTURE = fs.readFileSync(path.join(root, 'tests/fixtures/abs/abs-2401.00001.html'), 'utf8');

function loadPlaywright() {
  for (const d of [root, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean)) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  console.error('e2e abs: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}

async function open(exec, chromium, { lang = 'en', storage = {} } = {}) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-e2e-abs-'));
  const ctx = await chromium.launchPersistentContext(prof, {
    headless: false, executablePath: exec,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, `--lang=${lang}`],
  });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(sw.url()).host;
  const external = [];
  const onReq = (req) => {
    const u = req.url();
    if (u.startsWith('chrome-extension://') || u.startsWith('data:') || u === ABS) return;
    external.push(u);
  };
  ctx.on('request', onReq);
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u === ABS) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURE });
    if (u.startsWith('chrome-extension://')) return route.continue();
    return route.abort();
  });
  await sw.evaluate(async ({ lang, storage }) => {
    await chrome.storage.local.set({ language: lang, ...(storage.local || {}) });
    await chrome.storage.sync.set({ language: lang, ...(storage.sync || {}) });
  }, { lang, storage });
  return { ctx, sw, id, prof, external, close: async () => { await ctx.close(); fs.rmSync(prof, { recursive: true, force: true }); } };
}

async function r05(env, lang) {
  const p = await env.ctx.newPage();
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.goto(ABS);
  await p.waitForSelector('.arxiv-md-btn-container .arxiv-md-convert-btn', { timeout: 15000 });
  const rects = () => p.evaluate(() => [...document.querySelectorAll('.arxiv-md-btn-container > .arxiv-md-btn')]
    .map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
  const base = await rects();
  const fails = [];
  for (const state of ['', 'submitted', 'success', 'error', 'warning', 'canceled']) {
    for (const w of [1280, 375, 320]) {
      await p.setViewportSize({ width: w, height: 800 });
      const idle = await rects();
      await p.evaluate((st) => {
        const el = document.querySelector('.arxiv-md-progress');
        el.className = `arxiv-md-progress ${st}`.trim();
        el.style.display = 'flex';
        el.querySelector('.progress-text').textContent = 'A fairly long status title that could wrap on narrow screens';
        el.querySelector('.progress-detail').textContent = 'Detail line '.repeat(8);
      }, state);
      const shown = await rects();
      if (JSON.stringify(idle) !== JSON.stringify(shown)) fails.push({ lang, state, w, idle, shown });
      await p.evaluate(() => { document.querySelector('.arxiv-md-progress').style.display = 'none'; });
    }
  }
  await p.close();
  return { base, fails };
}

// 设计附录 D2（AX-04）：点「PDF」后下载中只换图标，PDF 按钮宽度、BibTeX 的 left 都不变，且有 aria-busy
async function ax04(env) {
  const p = await env.ctx.newPage();
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.goto(ABS);
  const sel = '.arxiv-md-btn-container .arxiv-pdf-download-btn';
  await p.waitForSelector(sel, { timeout: 15000 });
  // 页面主世界的 MutationObserver 能看到内容脚本改的 DOM：每次按钮内容/属性变化时同步量一次
  await p.evaluate((sel) => {
    const b = document.querySelector(sel);
    const all = () => [...document.querySelectorAll('.arxiv-md-btn-container > .arxiv-md-btn')].map((x) => { const r = x.getBoundingClientRect(); return [r.left, r.width]; });
    window.__ax04 = { base: all(), seen: [] };
    new MutationObserver(() => window.__ax04.seen.push({ busy: b.getAttribute('aria-busy'), text: b.textContent, rects: all() })).observe(b, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
  }, sel);
  await p.click(sel);
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => window.__ax04);
  await p.close();
  const deltas = r.seen.map((s) => Math.max(...s.rects.map((x, i) => Math.max(Math.abs(x[0] - r.base[i][0]), Math.abs(x[1] - r.base[i][1])))));
  return { busySeen: r.seen.some((s) => s.busy === 'true'), busyCleared: r.seen.length > 0 && r.seen[r.seen.length - 1].busy !== 'true', maxDelta: deltas.length ? Math.round(Math.max(...deltas) * 100) / 100 : null, n: r.seen.length };
}

async function c10(env, lang, provider) {
  const res = { provider, lang };
  const p = await env.ctx.newPage();
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.goto(ABS);
  const btn = '.arxiv-md-btn-container .arxiv-md-convert-btn';
  await p.waitForSelector(btn, { timeout: 15000 });
  const rects = () => p.evaluate(() => [...document.querySelectorAll('.arxiv-md-btn-container > .arxiv-md-btn')]
    .map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
  const base = await rects();
  // 点一次：不应打开任何新页面（设置页 #disclose 已移除）
  const waiter = env.ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null);
  await p.click(btn);
  const opened = await waiter;
  res.openedPage = opened ? opened.url() : null;
  await p.waitForTimeout(1500);
  res.notice = await p.evaluate(() => !!document.querySelector('.arxiv-md-progress[data-notice]'));
  res.shift = JSON.stringify(base) !== JSON.stringify(await rects());
  if (process.env.E2E_ABS_SHOTS) await p.screenshot({ path: path.join(process.env.E2E_ABS_SHOTS, `c10-abs-${provider}-${lang}.png`) });
  res.tasks = await env.sw.evaluate(async () => { const r = await chrome.storage.local.get(null); return Object.keys(r).filter((k) => /task/i.test(k)).map((k) => (Array.isArray(r[k]) ? r[k].length : 1)).reduce((a, b) => a + b, 0); });
  res.awaiting = await env.sw.evaluate(async () => { const r = await chrome.storage.local.get(null); return Object.values(r).flatMap((v) => (Array.isArray(v) ? v : [])).filter((t) => t && /^awaiting_/.test(t.status)).length; });
  await p.close();
  return res;
}

(async () => {
  const exec = process.env.CHROME_PATH;
  if (!exec || !fs.existsSync(exec)) { console.error('e2e abs: 请设置 CHROME_PATH'); process.exit(2); }
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) { console.error('e2e abs: 先 npm run build'); process.exit(2); }
  const { chromium } = loadPlaywright();
  const only = process.env.E2E_ABS_ONLY || '';
  let fail = 0;
  const out = {};
  for (const lang of ['en', 'zh']) {
    if (!only || only === 'r05') {
      const env = await open(exec, chromium, { lang });
      try {
        const r = await r05(env, lang);
        out[`r05-${lang}`] = r;
        if (r.fails.length) { fail++; console.error(`e2e abs: FAIL R05 ${lang} ${JSON.stringify(r.fails[0])}`); }
      } finally { await env.close(); }
    }
    if (!only || only === 'ax04') {
      const env = await open(exec, chromium, { lang });
      try {
        const r = await ax04(env);
        out[`ax04-${lang}`] = r;
        console.log(`e2e abs: AX-04 ${lang} ${JSON.stringify(r)}`);
        if (!r.busySeen || !r.busyCleared || r.maxDelta !== 0) { fail++; console.error(`e2e abs: FAIL AX-04 ${lang} ${JSON.stringify(r)}`); }
      } finally { await env.close(); }
    }
  }
  for (const lang of ['en', 'zh']) {
    if (only && only !== 'c10') continue;
    for (const provider of ['paddleocr', 'mineru']) {
      const env = await open(exec, chromium, { lang, storage: { sync: { conversionMode: 'always', pdfProvider: provider }, local: { providerKeys: { [provider]: 'fixture-not-a-real-key' } } } });
      try {
        const r = await c10(env, lang, provider);
        out[`c10-${provider}-${lang}`] = r;
        const bad = [];
        if (r.openedPage) bad.push(`a page was opened: ${r.openedPage}`);
        if (r.notice) bad.push('gate notice shown on the abs page');
        if (r.shift) bad.push('R05 button shift');
        if (!r.tasks) bad.push('no PDF task was created');
        if (r.awaiting) bad.push(`task left awaiting confirmation: ${r.awaiting}`);
        if (bad.length) { fail++; console.error(`e2e abs: FAIL C10 ${provider} ${lang}: ${bad.join('; ')}`); }
      } finally { await env.close(); }
    }
  }
  if (process.env.E2E_ABS_OUT) fs.writeFileSync(process.env.E2E_ABS_OUT, JSON.stringify(out, null, 1));
  console.log(fail ? `e2e abs buttons: FAIL (${fail})` : 'e2e abs buttons: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
