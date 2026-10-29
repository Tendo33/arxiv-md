/* eslint-env node */
/* eslint-disable no-console */
// 设计复验 6a49976 M2：设置页 #disclose=<后端> 确认后，✓ 行在被确认卡片的正下方（同列、左对齐），并带服务名。
// 1280（双列）分别确认 MinerU 和 PaddleOCR；375（单列）也各测一次。运行条件同 e2e-shortcut.js。
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
  console.error('e2e confirmed: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}
const NAME = { mineru: 'MinerU', paddleocr: 'PaddleOCR' };

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e confirmed: CHROME_PATH 未设置或不存在'); process.exit(2); }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-confirmed-'));
  const ctx = await chromium.launchPersistentContext(prof, { headless: false, executablePath, args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
  const out = {};
  let fail = 0;
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const id = sw.url().split('/')[2];
    for (const lang of ['zh', 'en']) {
      for (const w of [1280, 375]) {
        for (const prov of ['mineru', 'paddleocr']) {
          await sw.evaluate(async (l) => { await chrome.storage.sync.clear(); await chrome.storage.local.clear(); await chrome.storage.sync.set({ language: l }); }, lang);
          const p = await ctx.newPage();
          await p.setViewportSize({ width: w, height: 900 });
          await p.addInitScript(() => { chrome.permissions.request = async () => true; });
          await p.goto(`chrome-extension://${id}/settings.html#disclose=${prov}`);
          await p.waitForSelector('#pdPanel', { timeout: 10000 });
          await p.click('#pdPanel .btn-primary', { timeout: 5000 });
          await p.waitForSelector('#pdConfirmed:not([hidden])', { timeout: 5000 });
          const m = await p.evaluate((pv) => {
            const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; };
            const el = document.getElementById('pdConfirmed');
            const cards = [...document.querySelectorAll('.provider-card')].map((c) => ({ p: c.dataset.provider, ...R(c) }));
            return { text: el.textContent, line: R(el), card: cards.find((c) => c.p === pv), others: cards.filter((c) => c.p !== pv) };
          }, prov);
          const { line, card, others } = m;
          const name = NAME[prov];
          m.gap = line.t - card.b;
          m.ok = m.text.startsWith('✓') && m.text.includes(name)
            && Math.abs(line.l - card.l) <= 1 && m.gap > 0 && m.gap <= 32
            && others.every((o) => !(o.t >= card.b && o.b <= line.t)); // 中间不能夹着另一张卡片
          if (w === 1280) m.ok = m.ok && others.every((o) => o.l !== card.l) && line.r <= card.r + 1;
          out[`${lang}-${w}-${prov}`] = m;
          if (!m.ok) { console.error(`e2e confirmed: FAIL ${lang}@${w} ${prov} ${JSON.stringify(m)}`); fail++; }
          const shots = process.env.E2E_CONFIRMED_SHOTS;
          if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.locator('#pdfProviderSection').screenshot({ path: path.join(shots, `confirmed-${lang}-${w}-${prov}.png`) }); }
          await p.close();
        }
      }
    }
  } finally {
    await ctx.close();
    fs.rmSync(prof, { recursive: true, force: true });
  }
  if (process.env.E2E_CONFIRMED_OUT) fs.writeFileSync(process.env.E2E_CONFIRMED_OUT, JSON.stringify(out, null, 1));
  console.log(fail ? `e2e settings confirmed: FAIL (${fail})` : 'e2e settings confirmed: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
