/* eslint-env node */
/* eslint-disable no-console */
// 1.2.2（Simon 决定：使用时零确认、零运行时授权）：设置页点后端卡片 → 直接保存，
// 不出现数据说明面板、授权 / 撤销按钮，也不调用 chrome.permissions.request / contains / remove。
// zh / en × 1280 / 375 × 两个后端各测一次。运行条件同 e2e-shortcut.js。
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
  console.error('e2e provider pick: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e provider pick: CHROME_PATH 未设置或不存在'); process.exit(2); }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-provider-pick-'));
  const ctx = await chromium.launchPersistentContext(prof, { headless: false, executablePath, args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
  const out = {};
  let fail = 0;
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const id = sw.url().split('/')[2];
    for (const lang of ['zh', 'en']) {
      for (const w of [1280, 375]) {
        for (const prov of ['mineru', 'paddleocr']) {
          const from = prov === 'mineru' ? 'paddleocr' : 'mineru';
          await sw.evaluate(async ({ l, f }) => { await chrome.storage.sync.clear(); await chrome.storage.local.clear(); await chrome.storage.sync.set({ language: l, pdfProvider: f }); }, { l: lang, f: from });
          const p = await ctx.newPage();
          await p.setViewportSize({ width: w, height: 900 });
          // 只记录调用次数，不改变行为：1.2.2 起设置页不应碰 permissions API
          await p.addInitScript(() => {
            window.__permCalls = [];
            if (chrome.permissions) {
              for (const k of ['request', 'contains', 'remove']) {
                const orig = chrome.permissions[k] && chrome.permissions[k].bind(chrome.permissions);
                try { chrome.permissions[k] = (...a) => { window.__permCalls.push(k); return orig ? orig(...a) : Promise.resolve(false); }; } catch { /* 只读时忽略 */ }
              }
            }
          });
          await p.goto(`chrome-extension://${id}/settings.html`);
          await p.waitForSelector(`.provider-card[data-provider="${prov}"]`, { timeout: 10000 });
          await p.waitForTimeout(300);
          await p.click(`.provider-card[data-provider="${prov}"]`, { timeout: 5000 });
          await p.waitForTimeout(600);
          const saved = await sw.evaluate(async () => (await chrome.storage.sync.get('pdfProvider')).pdfProvider);
          const m = await p.evaluate((pv) => ({
            checked: (document.querySelector('input[name="pdfProvider"]:checked') || {}).value || null,
            panel: !!document.getElementById('pdPanel'),
            grant: !!document.getElementById('grantPermissionBtn'),
            revoke: !!document.getElementById('revokePermissionBtn'),
            reinitShown: !!(document.getElementById('reinitBtn') && !document.getElementById('reinitBtn').hidden),
            permCalls: window.__permCalls.slice(),
            pv,
          }), prov);
          m.saved = saved;
          m.ok = saved === prov && m.checked === prov && !m.panel && !m.grant && !m.revoke && m.permCalls.length === 0
            && m.reinitShown === (prov === 'paddleocr');
          out[`${lang}-${w}-${prov}`] = m;
          if (!m.ok) { console.error(`e2e provider pick: FAIL ${lang}@${w} ${prov} ${JSON.stringify(m)}`); fail++; }
          const shots = process.env.E2E_PROVIDER_PICK_SHOTS;
          if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.locator('#pdfProviderSection').screenshot({ path: path.join(shots, `provider-pick-${lang}-${w}-${prov}.png`) }); }
          await p.close();
        }
      }
    }
  } finally {
    await ctx.close();
    fs.rmSync(prof, { recursive: true, force: true });
  }
  if (process.env.E2E_PROVIDER_PICK_OUT) fs.writeFileSync(process.env.E2E_PROVIDER_PICK_OUT, JSON.stringify(out, null, 1));
  console.log(fail ? `e2e settings provider pick: FAIL (${fail})` : 'e2e settings provider pick: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
