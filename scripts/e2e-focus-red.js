/* eslint-env node */
/* eslint-disable no-console */
// 设计复验 15fe0f9 R07 扩展回归：所有 primary / confirm 按钮键盘聚焦后，在 0/50/150/350ms
// 采样 computed outline 和 box-shadow，都不能含品牌红 rgb(179,27,27) / rgb(248,113,113)（含过渡中间帧）。
// 按钮按 class/role 选，不按文案选。另核对 en 披露确认按钮的可见文字和可访问名是 "Confirm and continue"。
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
  console.error('e2e focus-red: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR');
  process.exit(2);
}
const SAMPLES = [0, 50, 150, 350];
const SETTINGS_SEL = '.btn-primary, .pd-ok, .pd-cancel, [role=dialog] .btn, [role=alertdialog] .btn';
const POPUP_SEL = '.btn-primary, .confirm-btn';

// 在页面里：键盘模式下逐个聚焦，按时间点采样
const sampleAll = ([sel, SAMPLES]) => new Promise((resolve) => {
  const RED = [[179, 27, 27], [248, 113, 113]];
  const hasRed = (s) => (s.match(/rgba?\([^)]*\)/g) || []).some((c) => {
    const n = c.match(/[\d.]+/g).map(Number);
    return (n[3] === undefined || n[3] > 0) && RED.some((r) => r.every((v, i) => Math.abs(v - n[i]) < 2));
  });
  const els = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length);
  const out = [];
  let i = 0;
  const next = () => {
    if (i >= els.length) { resolve(out); return; }
    const e = els[i++];
    document.activeElement?.blur();
    e.disabled = false;
    e.focus();
    const t0 = performance.now();
    const rec = { id: e.id || [...e.classList].join('.'), fv: e.matches(':focus-visible'), s: [] };
    let k = 0;
    const tick = () => {
      const s = getComputedStyle(e);
      rec.s.push({ t: SAMPLES[k], outline: s.outlineColor + ' ' + s.outlineStyle, shadow: s.boxShadow, red: hasRed(s.outlineStyle === 'none' ? '' : s.outlineColor) || hasRed(s.boxShadow) });
      k++;
      if (k < SAMPLES.length) setTimeout(tick, Math.max(0, SAMPLES[k] - (performance.now() - t0)));
      else { out.push(rec); next(); }
    };
    tick();
  };
  next();
});

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e focus-red: CHROME_PATH 未设置或不存在'); process.exit(2); }
  let fail = 0;
  const out = {};
  for (const lang of ['zh', 'en']) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-focusred-'));
    const ctx = await chromium.launchPersistentContext(prof, { headless: false, executablePath, args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
    try {
      const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
      const id = sw.url().split('/')[2];
      await sw.evaluate(async (l) => { await chrome.storage.sync.set({ language: l }); }, lang);
      for (const theme of ['light', 'dark']) {
        const views = [
          ...['paddleocr', 'mineru'].map((pv) => ({ name: `disclose-${pv}`, url: `settings.html#disclose=${pv}`, sel: SETTINGS_SEL, wait: '.pd-ok' })),
          { name: 'settings', url: 'settings.html', sel: '.btn', wait: 'body' },
          { name: 'popup', url: 'popup.html', sel: POPUP_SEL, wait: '#exportBtn', popup: true },
        ];
        for (const v of views) {
          const p = await ctx.newPage();
          await p.setViewportSize({ width: 375, height: 700 });
          await p.emulateMedia({ colorScheme: theme });
          if (v.popup) await p.addInitScript(() => { chrome.tabs.query = async () => [{ id: 999999, url: 'https://arxiv.org/abs/1706.03762', title: 'x' }]; });
          await p.goto(`chrome-extension://${id}/${v.url}`);
          await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
          await p.waitForSelector(v.wait, { timeout: 10000 });
          await p.waitForTimeout(400);
          if (v.popup) await p.evaluate(() => { const o = document.getElementById('confirmOverlay'); o.hidden = false; o.inert = false; o.classList.add('show'); });
          if (v.name.startsWith('disclose') && lang === 'en') {
            const ok = await p.evaluate(() => { const b = document.querySelector('.pd-ok'); return { text: b.textContent.trim(), aria: b.getAttribute('aria-label') }; });
            const good = ok.text === 'Confirm and continue' && (ok.aria === null || ok.aria === 'Confirm and continue');
            console.log(`${good ? 'PASS' : 'FAIL'} en-copy-${v.name}-${theme} ${JSON.stringify(ok)}`);
            if (!good) fail++;
          }
          await p.keyboard.press('Shift'); // 让后续 focus() 走键盘模式（:focus-visible）
          const recs = await p.evaluate(sampleAll, [v.sel, SAMPLES]);
          for (const r of recs) {
            const bad = !r.fv || r.s.some((x) => x.red);
            const key = `${v.name}-${lang}-${theme}-${r.id}`;
            out[key] = r;
            console.log(`${bad ? 'FAIL' : 'PASS'} ${key} fv=${r.fv} ${r.s.map((x) => `${x.t}ms:${x.red ? 'RED ' + x.shadow : 'ok'}`).join(' ')}`);
            if (bad) fail++;
          }
          if (!recs.length) { console.log(`FAIL ${v.name}-${lang}-${theme} 没找到按钮`); fail++; }
          await p.close();
        }
      }
    } finally {
      await ctx.close();
      fs.rmSync(prof, { recursive: true, force: true });
    }
  }
  if (process.env.E2E_FOCUSRED_OUT) fs.writeFileSync(process.env.E2E_FOCUSRED_OUT, JSON.stringify(out, null, 2));
  console.log(fail ? `e2e focus-red: ${fail} FAIL` : 'e2e focus-red: PASS');
  process.exit(fail ? 1 : 0);
})();
