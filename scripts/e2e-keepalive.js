/* eslint-env node */
/* eslint-disable no-console */
// QA P1-KA 回归：popup「PDF 解析」/ abs 按钮走 CONVERT_PAPER（forceMineru），任务建好后 keepAlive alarm 必须在；
// 然后用 CDP ServiceWorker.stopAllWorkers 强停 SW，等 alarm 周期（0.4 min）内 SW 被叫醒、任务被续上（SW 重新出现）。
// 网络请求全部被 route 挂起（不出网，模拟 hang 模式），所以任务停在处理中。
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
  console.error('e2e keepalive: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e keepalive: CHROME_PATH 未设置或不存在'); process.exit(2); }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-keepalive-'));
  const ctx = await chromium.launchPersistentContext(prof, { headless: false, executablePath, args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
  let fail = 0;
  const check = (ok, name, info) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info ? JSON.stringify(info) : ''}`); if (!ok) fail++; };
  try {
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, () => { /* 挂起，不出网 */ });
    let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const id = sw.url().split('/')[2];
    await sw.evaluate(async () => {
      await chrome.storage.sync.set({ language: 'en', pdfProvider: 'mineru' });
      await chrome.storage.local.set({ providerKeys: { mineru: 'fixture-not-a-real-key' }, 'disclosureAck.mineru': 1 });
      await chrome.alarms.clearAll();
    });
    const p = await ctx.newPage();
    await p.goto(`chrome-extension://${id}/popup.html`);
    const resp = await p.evaluate(() => chrome.runtime.sendMessage({ type: 'CONVERT_PAPER', data: { arxivId: '1706.03762', title: 'Attention Is All You Need', forceMineru: true } }));
    await p.waitForTimeout(1500);
    const alarms = await sw.evaluate(async () => (await chrome.alarms.getAll()).map((a) => a.name));
    check(!!(resp && resp.success) && alarms.includes('keepAlive'), 'convert-paper-path-has-keepAlive', { success: resp && resp.success, alarms });
    await p.close(); // 不留扩展页，否则 SW 不会真的停
    const cdp = await ctx.newCDPSession(await ctx.newPage());
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    const stoppedAt = Date.now();
    const woke = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), 60000);
      cdp.on('ServiceWorker.workerVersionUpdated', (e) => {
        if (e.versions.some((v) => v.runningStatus === 'running' && Date.now() - stoppedAt > 500)) { clearTimeout(t); resolve(Date.now() - stoppedAt); }
      });
    });
    check(woke !== null, 'sw-woken-by-alarm-after-stop', { ms: woke });
  } finally {
    await ctx.close();
    fs.rmSync(prof, { recursive: true, force: true });
  }
  console.log(fail ? `e2e keepalive: ${fail} FAIL` : 'e2e keepalive: PASS');
  process.exit(fail ? 1 : 0);
})();
