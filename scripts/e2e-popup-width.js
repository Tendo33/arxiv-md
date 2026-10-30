/* eslint-env node */
/* eslint-disable no-console */
// 设计必改（R05 类布局跳动）：popup 在所有状态下外宽都固定 360px。
// 状态（两张状态表的并集）：不支持页 / 空列表 / 有任务 / 需要 Key / 有 Key / 清空确认 / 旧版 awaiting_consent 任务（1.2.2 起不再产生，显示「需重试」和「重试」）/ 出错（失败任务 + 无法连接提示），
// 每种在 320、360、375 宽视口下各量一次 html、body、.pop 的外宽，断言全部 = 360（差 ≤0.5px）。
// 说明：Playwright 打不开工具栏 action popup，这里用固定视口页面模拟；真实 popup 由 QA 在 Chrome 里复核。
// 运行条件同 e2e-shortcut.js。E2E_WIDTH_OUT=<file> 时写出测量 JSON。
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
  console.error('e2e width: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}

const ARXIV = { id: 999999, url: 'https://arxiv.org/abs/2402.19173', title: 'StarCoder 2 and The Stack v2' };
const OTHER = { id: 999998, url: 'https://example.com/', title: 'Example' };
const t = (n, o) => ({ progress: 0, createdAt: n - 60e3, provider: 'mineru', ...o });
const STATES = {
  unsupported: { sync: {}, tab: OTHER, tasks: () => [] },
  empty: { sync: {}, tab: ARXIV, tasks: () => [] },
  tasks: { sync: {}, tab: ARXIV, tasks: (n) => [t(n, { id: 'c', status: 'completed', progress: 100, provider: 'paddleocr', zipUrl: 'https://example.com/a.zip', paperInfo: { arxivId: '1810.04805', title: 'BERT' } })] },
  keyNeeded: { sync: { pdfProvider: 'paddleocr' }, tab: ARXIV, tasks: () => [] },
  keySet: { sync: { pdfProvider: 'paddleocr' }, keys: { paddleocr: 'dummy-e2e' }, tab: ARXIV, tasks: () => [] },
  clearConfirm: { sync: {}, tab: ARXIV, click: ['#recentAll', '#clearCompletedBtn'], tasks: (n) => [1, 2, 3, 4].map((i) => t(n, { id: `c${i}`, status: 'completed', progress: 100, provider: 'paddleocr', zipUrl: 'https://example.com/a.zip', paperInfo: { arxivId: `1810.0480${i}`, title: `Paper ${i}` } })) },
  gate: { sync: {}, tab: ARXIV, tasks: (n) => [t(n, { id: 'a', status: 'awaiting_consent', paperInfo: { arxivId: '2401.00001', title: 'A Non-OA PDF awaiting consent with a long title' } })] },
  error: { sync: {}, tab: ARXIV, tasks: (n) => [t(n, { id: 'b', status: 'failed', errorCode: 'PROVIDER_FAILED', errorReason: 'forbidden_empty', error: 'raw', paperInfo: { arxivId: '2401.00002', title: 'Failed paper' } })] },
};

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e width: CHROME_PATH 未设置或不存在'); process.exit(2); }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-width-'));
  const ctx = await chromium.launchPersistentContext(prof, {
    headless: false, executablePath,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  const out = {};
  let fail = 0;
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const id = sw.url().split('/')[2];
    for (const [name, s] of Object.entries(STATES)) {
      await sw.evaluate(async ({ sync, tasks, keys }) => {
        await chrome.storage.sync.clear();
        await chrome.storage.sync.set({ language: 'en', ...sync });
        await chrome.storage.local.set({ providerKeys: keys, mineruTasks: tasks });
      }, { sync: s.sync, keys: s.keys || {}, tasks: s.tasks(Date.now()) });
      for (const w of [320, 360, 375]) {
        const p = await ctx.newPage();
        await p.setViewportSize({ width: w, height: 600 });
        await p.addInitScript((tab) => { chrome.tabs.query = async () => [tab]; }, s.tab);
        await p.goto(`chrome-extension://${id}/popup.html`);
        await p.waitForTimeout(900);
        if (s.click) { for (const c of s.click) await p.click(c, { timeout: 5000 }); await p.waitForSelector('#confirmOverlay.show', { timeout: 5000 }); }
        const m = await p.evaluate(() => {
          const W = (e) => e.getBoundingClientRect().width;
          const vis = (i) => { const e = document.getElementById(i); return !!e && !e.classList.contains('hidden') && e.offsetParent !== null; };
          return {
            html: W(document.documentElement), body: W(document.body), pop: W(document.getElementById('pop')),
            shown: ['unsupported', 'recentEmpty', 'taskList', 'alertKey', 'alertErr', 'alertInfo'].filter(vis).concat(document.getElementById('confirmOverlay').classList.contains('show') ? ['confirm'] : []),
            rows: document.querySelectorAll('#taskList .row').length,
          };
        });
        out[`${name}-${w}`] = m;
        const bad = [m.html, m.body, m.pop].some((v) => Math.abs(v - 360) > 0.5);
        if (bad) { console.error(`e2e width: FAIL ${name}@${w} ${JSON.stringify(m)}`); fail++; }
        await p.close();
      }
    }
  } finally {
    await ctx.close();
    fs.rmSync(prof, { recursive: true, force: true });
  }
  const ws = Object.values(out).map((m) => m.pop);
  if (Math.max(...ws) - Math.min(...ws) > 0.5) { console.error('e2e width: FAIL 各状态外宽不一致'); fail++; }
  if (process.env.E2E_WIDTH_OUT) fs.writeFileSync(process.env.E2E_WIDTH_OUT, JSON.stringify(out, null, 1));
  console.log(fail ? `e2e popup width: FAIL (${fail})` : 'e2e popup width: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
