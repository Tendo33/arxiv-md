/* eslint-env node */
/* eslint-disable no-console */
// 设计裁定 R-2：P2-DNR 等待说明在同一任务行内、标题和状态/元信息之下，是行内最后一个文字元素。
// zh/en × light/dark × 320/360/375：断言 DOM 顺序（.row-note 是 .row 的最后一个子元素）、视觉顺序（note.top ≥ 标题/徽标/操作的 bottom），
// margin-top 4px、左缘 = 标题文字 .n 的左缘（≤0.5px）、.nw 不拆、不横向溢出；操作区 y 与无提示的同一行一致（≤1px）。
// 说明：Playwright 打不开工具栏 action popup，这里用固定视口页面模拟。E2E_DNR_OUT=<dir> 写 JSON 和截图。
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
  console.error('e2e dnr note: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR'); process.exit(2);
}
const TAB = { id: 999999, url: 'https://arxiv.org/abs/2402.19173', title: 'StarCoder 2 and The Stack v2' };
const task = (n, dnr) => ({ id: 'd', status: 'pending', progress: 0, createdAt: n - 30e3, provider: 'paddleocr', ...(dnr ? { dnrReinitWaitSince: n } : {}), paperInfo: { arxivId: '2401.00009', title: 'Waiting for network setup' } });

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) { console.error('e2e dnr note: CHROME_PATH 未设置或不存在'); process.exit(2); }
  const outDir = process.env.E2E_DNR_OUT;
  if (outDir) fs.mkdirSync(outDir, { recursive: true });
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-dnr-'));
  const ctx = await chromium.launchPersistentContext(prof, { headless: false, executablePath, args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
  const out = {};
  let fail = 0;
  const bad = (k, why) => { console.error(`e2e dnr note: FAIL ${k} ${why}`); fail++; };
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const id = sw.url().split('/')[2];
    await new Promise((r) => setTimeout(r, 1500)); // 让 SW 启动时的续跑先结束，之后写入的任务不会被拿去处理
    for (const lang of ['zh', 'en']) for (const theme of ['light', 'dark']) for (const w of [320, 360, 375]) {
      const k = `${lang}-${theme}-${w}`;
      const measure = async (dnr) => {
        await sw.evaluate(async ({ lang, theme, tasks }) => {
          await chrome.storage.sync.clear();
          await chrome.storage.sync.set({ language: lang, theme });
          await chrome.storage.local.set({ providerKeys: {}, mineruTasks: tasks });
        }, { lang, theme, tasks: [task(Date.now(), dnr)] });
        const p = await ctx.newPage();
        await p.setViewportSize({ width: w, height: 600 });
        await p.addInitScript(({ tab, theme }) => { chrome.tabs.query = async () => [tab]; document.documentElement.dataset.theme = theme; }, { tab: TAB, theme });
        await p.goto(`chrome-extension://${id}/popup.html`);
        await p.waitForTimeout(900);
        await p.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
        const m = await p.evaluate(() => {
          const row = document.querySelector('#taskList .row');
          if (!row) return null;
          const R = (e) => e && e.getBoundingClientRect();
          const note = row.querySelector('.row-note');
          const rr = R(row);
          const cs = getComputedStyle(row);
          const out = { status: row.dataset.status, act: R(row.querySelector('.row-act')).top, contentLeft: rr.left + parseFloat(cs.paddingLeft), htmlW: document.documentElement.getBoundingClientRect().width, scrollW: document.documentElement.scrollWidth };
          if (!note) return out;
          const nr = R(note);
          const above = ['.badge', '.n', '.row-act', 'small'].map((s) => R(row.querySelector(s))).filter(Boolean);
          const nw = [...note.querySelectorAll('.nw')].map((e) => e.getClientRects().length);
          return { ...out, last: row.lastElementChild === note, role: note.getAttribute('role'), noteTop: nr.top, noteLeft: nr.left, titleLeft: R(row.querySelector('.n')).left, noteRight: nr.right, rowRight: rr.right,
            aboveBottom: Math.max(...above.map((b) => b.bottom)), mt: getComputedStyle(note).marginTop, nw: nw.length, nwSplit: nw.filter((n) => n > 1).length,
            color: getComputedStyle(note).color, font: `${getComputedStyle(note).fontSize}/${getComputedStyle(note).lineHeight}`, text: note.textContent };
        });
        if (dnr && outDir && m) await p.screenshot({ path: path.join(outDir, `popup-dnr-row-${k}.png`) });
        await p.close();
        return m;
      };
      let m = null;
      for (let i = 0; i < 3 && !(m && m.status === 'pending' && m.text); i++) m = await measure(true);
      const base = await measure(false);
      out[k] = { ...m, actNoNote: base && base.act, leftDiff: m && m.titleLeft != null ? Math.abs(m.noteLeft - m.titleLeft) : null };
      if (!m || !m.text) { bad(k, 'no .row-note'); continue; }
      if (!m.last) bad(k, '.row-note 不是行内最后一个元素');
      if (m.role !== 'status') bad(k, 'role != status');
      if (m.noteTop < m.aboveBottom - 0.5) bad(k, `提示不在标题/元信息之下 ${m.noteTop} < ${m.aboveBottom}`);
      if (m.mt !== '4px') bad(k, `margin-top ${m.mt}`);
      m.leftDiff = Math.abs(m.noteLeft - m.titleLeft);
      if (m.leftDiff > 0.5) bad(k, `左缘 ${m.noteLeft} != 标题文字 ${m.titleLeft}`);
      if (m.noteRight > m.rowRight + 0.5 || m.scrollW > Math.max(w, m.htmlW) + 0.5) bad(k, '横向溢出');
      if (m.font !== '12px/18px') bad(k, `字号 ${m.font}`);
      if (lang === 'zh' && (m.nw !== 4 || m.nwSplit)) bad(k, `.nw ${m.nw} split ${m.nwSplit}`);
      if (base && Math.abs(base.act - m.act) > 1) bad(k, `操作区 y 位移 ${base.act} → ${m.act}`);
    }
  } finally {
    await ctx.close();
    fs.rmSync(prof, { recursive: true, force: true });
  }
  if (outDir) fs.writeFileSync(path.join(outDir, 'dnr-note.json'), JSON.stringify(out, null, 1));
  console.log(fail ? `e2e popup dnr note: FAIL (${fail})` : 'e2e popup dnr note: PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
