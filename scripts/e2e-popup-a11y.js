/* eslint-env node */
/* eslint-disable no-console */
// 设计增量验收 N1 回归 e2e（npm run test:e2e 的第二步）：干净 profile 加载 dist，播种三条任务，
// 在 360 和 320 宽下打开 popup，用 Playwright 的 ariaSnapshot（可访问性树）逐行断言：
// 每一行都能读到后端名，且只读一次；.prov 不能是 display:none。
// 运行条件同 e2e-shortcut.js：CHROME_PATH 必填，playwright 来自本仓库或 E2E_PLAYWRIGHT_DIR，无显示器时用 xvfb-run。
// E2E_A11Y_OUT=<file> 时把每行的 ariaSnapshot 写成 JSON。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const LABEL = { mineru: 'MinerU', paddleocr: 'PaddleOCR' };

function loadPlaywright() {
  for (const d of [root, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean)) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  console.error('e2e a11y: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e a11y: CHROME_PATH 未设置或不存在'); process.exit(2); }
  const out = {};
  let fail = 0;
  for (const lang of ['zh', 'en']) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-a11y-'));
    const ctx = await chromium.launchPersistentContext(prof, {
      headless: false, executablePath,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
    try {
      const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
      const id = sw.url().split('/')[2];
      await sw.evaluate(async (l) => {
        const n = Date.now();
        await chrome.storage.sync.set({ language: l });
        await chrome.storage.local.set({ mineruTasks: [
          { id: 'a', status: 'awaiting_consent', progress: 0, createdAt: n - 30e3, provider: 'mineru', paperInfo: { arxivId: '2401.00001', title: 'Awaiting paper' } },
          { id: 'b', status: 'failed', progress: 0, createdAt: n - 90e3, provider: 'mineru', errorCode: 'PROVIDER_FAILED', errorReason: 'forbidden_empty', error: 'raw', paperInfo: { arxivId: '2401.00002', title: 'Failed paper' } },
          { id: 'c', status: 'completed', progress: 100, createdAt: n - 3600e3, provider: 'paddleocr', zipUrl: 'https://example.com/a.zip', paperInfo: { arxivId: '1810.04805', title: 'Done paper' } },
        ] });
      }, lang);
      for (const w of [360, 320]) {
        const p = await ctx.newPage();
        await p.setViewportSize({ width: w, height: 640 });
        await p.goto(`chrome-extension://${id}/popup.html`);
        await p.waitForSelector('#taskList .row', { timeout: 10000 });
        const rows = p.locator('#taskList .row');
        const nRows = await rows.count();
        if (nRows !== 3) { console.error(`e2e a11y: ${lang}@${w} 行数 ${nRows} ≠ 3`); fail++; }
        for (let i = 0; i < nRows; i++) {
          const row = rows.nth(i);
          const provider = await row.getAttribute('data-task-id').then((tid) => (tid === 'c' ? 'paddleocr' : 'mineru'));
          const snap = await row.ariaSnapshot();
          const display = await row.locator('.prov').evaluate((e) => getComputedStyle(e).display);
          const count = snap.split(LABEL[provider]).length - 1;
          const titleDup = await row.evaluate((r, lbl) => [...r.querySelectorAll('[title]')].some((e) => e.getAttribute('title').includes(lbl)), LABEL[provider]);
          out[`${lang}-${w}-${i}`] = { snapshot: snap, provider: LABEL[provider], count, provDisplay: display, titleDup };
          if (count !== 1 || display === 'none' || titleDup) {
            console.error(`e2e a11y: FAIL ${lang}@${w} row${i} count=${count} display=${display} titleDup=${titleDup}\n${snap}`);
            fail++;
          }
        }
        await p.close();
      }
    } finally {
      await ctx.close();
      fs.rmSync(prof, { recursive: true, force: true });
    }
  }
  if (process.env.E2E_A11Y_OUT) fs.writeFileSync(process.env.E2E_A11Y_OUT, JSON.stringify(out, null, 1));
  console.log(fail ? `e2e popup a11y: FAIL (${fail})` : 'e2e popup a11y: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
