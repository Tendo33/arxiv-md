/* eslint-env node */
/* eslint-disable no-console */
// abs-buttons v2 回归 e2e（design-abs-buttons-2026-10-29 R05）：干净 profile 加载 dist，
// 把 https://arxiv.org/abs/2401.00001 路由到离线 fixture（tests/fixtures/abs），其余请求一律拦下并计数。
// R05：状态行在每种状态（进行中 / 已提交 / 完成 / 失败 / 警告 / 已取消）下显示时，按钮行位移必须为 0。
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
  }
  if (process.env.E2E_ABS_OUT) fs.writeFileSync(process.env.E2E_ABS_OUT, JSON.stringify(out, null, 1));
  console.log(fail ? `e2e abs buttons: FAIL (${fail})` : 'e2e abs buttons: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
