/* eslint-env node */
/* eslint-disable no-console */
// 设计增量验收 N1 回归 e2e（npm run test:e2e 的第二步）：干净 profile 加载 dist，播种三条任务，
// 在 360 和 320 宽下打开 popup，用 Playwright 的 ariaSnapshot（可访问性树）逐行断言：
// 每一行都能读到后端名，且只读一次；.prov 不能是 display:none。
// 运行条件同 e2e-shortcut.js：CHROME_PATH 必填，playwright 来自本仓库或 E2E_PLAYWRIGHT_DIR，无显示器时用 xvfb-run。
// E2E_A11Y_OUT=<file> 时把每行的 ariaSnapshot 写成 JSON。
// rp2b（设计 ①②）：失败行覆盖全部错误码（含 forbidden_empty / key_not_on_device / 有无 host 的 PERMISSION_MISSING），
// 每行后端名仍只能读到一次；设置页 Key 测试的错误行（#tokenStatus）对每个能出现的错误，后端名最多一次。
// E2E_A11Y_SHOTS=<dir> 时额外拍 popup 任务行（QUOTA / TIMEOUT / forbidden_empty 在最上面）和设置页错误行，宽 320/375，亮色 / 暗色（data-theme="dark"）。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const LABEL = { mineru: 'MinerU', paddleocr: 'PaddleOCR' };
const CODES = ['AUTH_INVALID', 'QUOTA_EXCEEDED', 'RATE_LIMITED', 'FILE_UNSUPPORTED', 'TOO_LARGE', 'NETWORK', 'PERMISSION_MISSING', 'TIMEOUT', 'PROVIDER_FAILED'];
// 前三条最新（截图里在最上面）：QUOTA、TIMEOUT、forbidden_empty
const FAILED = [
  { errorCode: 'QUOTA_EXCEEDED' }, { errorCode: 'TIMEOUT' }, { errorCode: 'PROVIDER_FAILED', errorReason: 'forbidden_empty' },
  ...CODES.filter((c) => c !== 'QUOTA_EXCEEDED' && c !== 'TIMEOUT').map((c) => ({ errorCode: c })),
  { errorCode: 'PERMISSION_MISSING', errorHost: 'mineru.net' },
  { errorCode: 'PROVIDER_FAILED', errorReason: 'key_not_on_device' },
  { errorCode: 'PROVIDER_FAILED', errorReason: 'empty_result' },
];
// 设置页 Key 测试能走到的错误（PaddleOCR；TOO_LARGE/FILE_UNSUPPORTED 等 4xx 在测试连接里算 Key 有效，走不到）
const SETTINGS_CASES = {
  AUTH_INVALID: { status: 401, body: '' },
  QUOTA_EXCEEDED: { status: 429, body: '' },
  RATE_LIMITED: { status: 429, body: '', retryAfter: '5' },
  forbidden_empty: { status: 403, body: '' },
  PROVIDER_FAILED: { status: 500, body: '' },
  NETWORK: { throw: 'TypeError' },
  TIMEOUT: { throw: 'AbortError' },
};

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
      await sw.evaluate(async ([l, failed]) => {
        const n = Date.now();
        await chrome.storage.sync.set({ language: l });
        await chrome.storage.local.set({ mineruTasks: [
          { id: 'a', status: 'awaiting_consent', progress: 0, createdAt: n - 30e3, provider: 'mineru', paperInfo: { arxivId: '2401.00001', title: 'Awaiting paper' } },
          { id: 'b', status: 'failed', progress: 0, createdAt: n - 90e3, provider: 'mineru', errorCode: 'PROVIDER_FAILED', errorReason: 'forbidden_empty', error: 'raw', paperInfo: { arxivId: '2401.00002', title: 'Failed paper' } },
          { id: 'c', status: 'completed', progress: 100, createdAt: n - 3600e3, provider: 'paddleocr', zipUrl: 'https://example.com/a.zip', paperInfo: { arxivId: '1810.04805', title: 'Done paper' } },
          ...failed.map((f, i) => ({ id: `f${i}`, status: 'failed', progress: 0, createdAt: n - 5e3 - i * 1e3, provider: i % 2 ? 'paddleocr' : 'mineru', error: 'raw', ...f, paperInfo: { arxivId: `2402.0000${i}`, title: `Failed ${f.errorReason || f.errorCode}` } })),
        ] });
      }, [lang, FAILED]);
      for (const w of [360, 320]) {
        const p = await ctx.newPage();
        await p.setViewportSize({ width: w, height: 640 });
        await p.goto(`chrome-extension://${id}/popup.html`);
        await p.waitForSelector('#taskList .row', { timeout: 10000 });
        await p.click('#recentAll');
        await p.waitForFunction((n) => document.querySelectorAll('#taskList .row').length === n, 3 + FAILED.length, { timeout: 5000 }).catch(() => {});
        const rows = p.locator('#taskList .row');
        const nRows = await rows.count();
        if (nRows !== 3 + FAILED.length) { console.error(`e2e a11y: ${lang}@${w} 行数 ${nRows} ≠ ${3 + FAILED.length}`); fail++; }
        for (let i = 0; i < nRows; i++) {
          const row = rows.nth(i);
          const provider = await row.getAttribute('data-task-id').then((tid) => (tid === 'c' || (/^f\d+$/.test(tid) && Number(tid.slice(1)) % 2) ? 'paddleocr' : 'mineru'));
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
      const shots = process.env.E2E_A11Y_SHOTS;
      if (shots) {
        fs.mkdirSync(shots, { recursive: true });
        for (const theme of ['light', 'dark']) for (const w of [320, 375]) {
          const p = await ctx.newPage();
          await p.setViewportSize({ width: w, height: 1000 });
          await p.goto(`chrome-extension://${id}/popup.html`);
          await p.waitForSelector('#taskList .row', { timeout: 10000 });
          await p.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
          await p.waitForTimeout(300);
          await p.screenshot({ path: path.join(shots, `popup-rows-${lang}-${theme}-${w}.png`) });
          await p.close();
        }
      }
      // 设置页：Key 测试错误行
      await sw.evaluate(() => chrome.storage.sync.set({ pdfProvider: 'paddleocr' }));
      for (const [name, resp] of Object.entries(SETTINGS_CASES)) {
        const p = await ctx.newPage();
        await p.setViewportSize({ width: 375, height: 700 });
        await p.addInitScript((r) => {
          // 只在本页桩掉权限查询与网络，让 Key 测试走到各错误分支（不改 manifest、不真正授权）
          if (chrome.permissions) chrome.permissions.contains = (_q, cb) => (cb ? cb(true) : Promise.resolve(true));
          window.fetch = async () => {
            if (r.throw === 'AbortError') throw new DOMException('aborted', 'AbortError');
            if (r.throw) throw new TypeError('Failed to fetch');
            const h = new Headers(); if (r.retryAfter) h.set('Retry-After', r.retryAfter);
            return new Response(r.body || null, { status: r.status, headers: h });
          };
        }, resp);
        await p.goto(`chrome-extension://${id}/settings.html`);
        await p.waitForSelector('#providerKey', { timeout: 10000 });
        await p.waitForTimeout(500);
        await p.fill('#providerKey', 'fixture-key-e2e');
        await p.click('#testTokenBtn');
        await p.waitForFunction(() => { const e = document.getElementById('tokenStatus'); return /error/.test(e.className) && !/testing/.test(e.className); }, null, { timeout: 20000 });
        const text = (await p.textContent('#tokenStatus')).trim();
        const count = text.split('PaddleOCR').length - 1;
        out[`${lang}-settings-${name}`] = { text, count };
        if (count > 1 || /\{\w+\}|403|[A-Z]+_[A-Z_]+/.test(text)) { console.error(`e2e a11y: FAIL settings ${lang} ${name} count=${count} ${text}`); fail++; }
        if (shots && ['QUOTA_EXCEEDED', 'TIMEOUT', 'forbidden_empty'].includes(name)) {
          for (const theme of ['light', 'dark']) for (const w of [320, 375]) {
            await p.setViewportSize({ width: w, height: 700 });
            await p.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
            await p.locator('#tokenStatus').scrollIntoViewIfNeeded();
            await p.waitForTimeout(200);
            await p.screenshot({ path: path.join(shots, `settings-${name}-${lang}-${theme}-${w}.png`) });
          }
        }
        await p.close();
      }
      const texts = Object.keys(SETTINGS_CASES).map((k) => out[`${lang}-settings-${k}`].text);
      if (new Set(texts).size !== texts.length) { console.error(`e2e a11y: FAIL settings ${lang} 错误分支没有全部走到：${JSON.stringify(texts)}`); fail++; }
    } finally {
      await ctx.close();
      fs.rmSync(prof, { recursive: true, force: true });
    }
  }
  if (process.env.E2E_A11Y_OUT) fs.writeFileSync(process.env.E2E_A11Y_OUT, JSON.stringify(out, null, 1));
  console.log(fail ? `e2e popup a11y: FAIL (${fail})` : 'e2e popup a11y: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
