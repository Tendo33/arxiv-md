/* eslint-env node */
/* eslint-disable no-console */
// batch8 ③：原 tools/selftest-arxiv.mjs 移入仓库。在线冒烟：干净 profile 加载 dist，访问真实 arxiv.org，
// 断言 ① 快捷键已注册 ② abs 页按钮转换 + 复制得到带引用/脚注的 Markdown ③ 断网时卡片给出错误文字
// ④ PDF 页内容脚本能收到 TRIGGER_CONVERSION（只查消息送达；旧 selftest 在这里也从没下载出文件，不作断言）⑤ popup 能打开且有内容。
// 依赖外网（arxiv.org），所以 CI 里放在单独的 continue-on-error 任务；本地：
//   npm run build && E2E_PLAYWRIGHT_DIR=/path/to/tools CHROME_PATH=/path/to/chrome xvfb-run -a node scripts/selftest-live.js
// 可选：SELFTEST_SHOTS=<目录> 保存截图（默认不截图，不往仓库里写文件）。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const dist = process.env.E2E_DIST || path.join(root, 'dist');
const SHOTS = process.env.SELFTEST_SHOTS || '';

function fail2(msg) { console.error(`selftest: ${msg}`); process.exit(2); }

function loadPlaywright() {
  for (const d of [root, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean)) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  return fail2('找不到 playwright。请设置 E2E_PLAYWRIGHT_DIR 指向含 node_modules/playwright 的目录。');
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name) });
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath || !fs.existsSync(executablePath)) fail2('CHROME_PATH 未设置或文件不存在。');
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) fail2(`找不到 ${path.join(dist, 'manifest.json')}，请先 npm run build。`);

  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'selftest-live-'));
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'selftest-dl-'));
  fs.mkdirSync(path.join(prof, 'Default'), { recursive: true });
  fs.writeFileSync(path.join(prof, 'Default', 'Preferences'), JSON.stringify({
    download: { default_directory: dl, prompt_for_download: false }, savefile: { default_directory: dl },
  }));
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(prof, {
      headless: false, executablePath, acceptDownloads: true, viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
  } catch (e) {
    fs.rmSync(prof, { recursive: true, force: true });
    fail2(`Chrome 启动失败：${String(e.message || e).split('\n')[0]}`);
  }
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const id = sw.url().split('/')[2];
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://arxiv.org' });

    const cmds = await sw.evaluate(() => chrome.commands.getAll());
    const c = cmds.find((x) => x.name === 'convert-current-paper');
    check('快捷键已注册', c && c.shortcut, c && c.shortcut);

    const p = await ctx.newPage();
    await p.goto('https://arxiv.org/abs/1706.03762', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.arxiv-md-convert-btn', { timeout: 20000 });
    await p.click('.arxiv-md-convert-btn');
    await p.waitForSelector('.arxiv-md-copy-btn', { timeout: 90000 });
    await shot(p, '01-result-card.png');
    await p.click('.arxiv-md-copy-btn');
    await p.waitForTimeout(800);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    check('abs 页转换并复制', clip.length > 5000, `len=${clip.length}`);
    check('复制内容含引用链接', /\]\(#bib\.bib\d+\)/.test(clip));
    check('复制内容含脚注', /\[\^1\]:/.test(clip));

    const p2 = await ctx.newPage();
    await p2.goto('https://arxiv.org/abs/2106.09685', { waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('.arxiv-md-convert-btn', { timeout: 20000 });
    await ctx.setOffline(true);
    await p2.click('.arxiv-md-convert-btn');
    await p2.waitForTimeout(4000);
    const offline = ((await p2.textContent('.arxiv-md-progress').catch(() => '')) || '').trim();
    await shot(p2, '03-offline.png');
    await ctx.setOffline(false);
    check('断网时卡片有提示文字', offline.length > 0, offline.slice(0, 80));

    const p3 = await ctx.newPage();
    await p3.goto('https://arxiv.org/pdf/1706.03762', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await p3.bringToFront();
    await p3.waitForTimeout(3000);
    const trig = await sw.evaluate(() => new Promise((r) => chrome.tabs.query({ active: true, currentWindow: true }, (t) => chrome.tabs.sendMessage(t[0].id, { type: 'TRIGGER_CONVERSION' }, () => r(chrome.runtime.lastError ? chrome.runtime.lastError.message : null)))));
    check('PDF 页收到 TRIGGER_CONVERSION', trig === null, trig || '');
    const pp = await ctx.newPage();
    await pp.setViewportSize({ width: 400, height: 600 });
    await pp.goto(`chrome-extension://${id}/popup.html`);
    await pp.waitForTimeout(1500);
    const popup = ((await pp.textContent('body')) || '').replace(/\s+/g, ' ').trim();
    await shot(pp, '04-popup.png');
    check('popup 打开且有内容', popup.length > 20, popup.slice(0, 60));
  } catch (e) {
    check('执行过程无异常', false, String(e.message || e).split('\n')[0]);
  } finally {
    await ctx.close();
    fs.rmSync(prof, { recursive: true, force: true });
    fs.rmSync(dl, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`selftest live: ${bad ? 'FAIL' : 'PASS'} (${results.length - bad}/${results.length})`);
  process.exit(bad ? 1 : 0);
})();
