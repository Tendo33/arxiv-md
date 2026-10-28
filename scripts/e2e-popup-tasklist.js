/* eslint-env node */
/* eslint-disable no-console */
// 审查员 S 增量报告「任务列表最小高度」（C）回归 e2e，是 npm run test:e2e 的第三步。
// 干净 profile 加载 dist，把当前标签页模拟成 arXiv abs 页，点「PDF 解析」触发缺 Key 提示（列表上方内容最多的状态），
// 在 320、360、375 宽、600 高（Chrome popup 上限）下，断言首行待确认任务的按钮完整处在 #taskList 的可见区域内，按钮折行时也一样。
// 运行条件同 e2e-shortcut.js。E2E_TASKLIST_OUT=<file> 时写出测量 JSON。
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
  console.error('e2e tasklist: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e tasklist: CHROME_PATH 未设置或不存在'); process.exit(2); }
  const out = {};
  let fail = 0;
  for (const lang of ['zh', 'en']) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-tasklist-'));
    const ctx = await chromium.launchPersistentContext(prof, {
      headless: false, executablePath,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
    try {
      const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
      const id = sw.url().split('/')[2];
      await sw.evaluate(async (l) => {
        const n = Date.now();
        await chrome.storage.sync.set({ language: l, pdfProvider: 'mineru' });
        await chrome.storage.local.set({ providerKeys: {}, mineruTasks: [
          { id: 'a', status: 'awaiting_consent', progress: 0, createdAt: n - 30e3, provider: 'mineru', paperInfo: { arxivId: '2401.00001', title: 'A Non-OA PDF awaiting consent with a long title' } },
          { id: 'b', status: 'failed', progress: 0, createdAt: n - 90e3, provider: 'mineru', errorCode: 'PROVIDER_FAILED', errorReason: 'forbidden_empty', error: 'raw', paperInfo: { arxivId: '2401.00002', title: 'Failed paper' } },
          { id: 'c', status: 'completed', progress: 100, createdAt: n - 3600e3, provider: 'paddleocr', zipUrl: 'https://example.com/a.zip', paperInfo: { arxivId: '1810.04805', title: 'BERT' } },
        ] });
      }, lang);
      for (const w of [320, 360, 375]) {
        const p = await ctx.newPage();
        await p.setViewportSize({ width: w, height: 600 });
        await p.addInitScript(() => { chrome.tabs.query = async () => [{ id: 999999, url: 'https://arxiv.org/abs/2402.19173', title: 'StarCoder 2 and The Stack v2' }]; });
        await p.goto(`chrome-extension://${id}/popup.html`);
        await p.waitForSelector('#taskList .row', { timeout: 10000 });
        await p.waitForTimeout(800);
        await p.click('#mineruBtn').catch(() => {});
        await p.waitForTimeout(400);
        const m = await p.evaluate(() => {
          const list = document.getElementById('taskList');
          list.scrollTop = 0;
          const lr = list.getBoundingClientRect();
          const row = list.querySelector('.row[data-status="awaiting_consent"]');
          const btns = [...row.querySelectorAll('.row-act button')].map((b) => {
            const r = b.getBoundingClientRect();
            return { text: b.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom) };
          });
          const rr = row.getBoundingClientRect();
          return { listTop: Math.round(lr.top), listBottom: Math.round(lr.bottom), listH: Math.round(lr.height), rowH: Math.round(rr.height), wrapped: btns.length && btns[0].top > rr.top + 12, btns };
        });
        m.ok = m.btns.length > 0 && m.btns.every((b) => b.top >= m.listTop && b.bottom <= m.listBottom);
        out[`${lang}-${w}`] = m;
        if (!m.ok) { console.error(`e2e tasklist: FAIL ${lang}@${w} ${JSON.stringify(m)}`); fail++; }
        await p.close();
      }
    } finally {
      await ctx.close();
      fs.rmSync(prof, { recursive: true, force: true });
    }
  }
  if (process.env.E2E_TASKLIST_OUT) fs.writeFileSync(process.env.E2E_TASKLIST_OUT, JSON.stringify(out, null, 1));
  console.log(fail ? `e2e popup tasklist: FAIL (${fail})` : 'e2e popup tasklist: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
