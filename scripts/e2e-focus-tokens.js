/* eslint-env node */
/* eslint-disable no-console */
// QA L-07 / AX-01：getComputedStyle 实测——亮/暗 × arxiv/zhihu 品牌下 --focus 都是蓝色且 ≠ --brand；
// popup 按钮 focus-visible 的 outline 颜色等于 --focus、不是品牌红。用法：CHROME_PATH=… E2E_PLAYWRIGHT_DIR=… xvfb-run -a node scripts/e2e-focus-tokens.js
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
function loadPlaywright() {
  for (const d of [root, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean)) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  console.error('e2e: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR'); process.exit(2);
}
const BLUES = { light: 'rgb(37, 99, 235)', dark: ['rgb(96, 165, 250)', 'rgb(147, 197, 253)'] };
const REDS = ['rgb(179, 27, 27)', 'rgb(248, 113, 113)'];

(async () => {
  const { chromium } = loadPlaywright();
  const css = fs.readFileSync(path.join(root, 'src/ui/shared/ui-v2.css'), 'utf8');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const page = await browser.newPage();
  let fail = 0;
  for (const theme of ['light', 'dark']) {
    for (const brand of ['arxiv', 'zhihu']) {
      await page.setContent(`<html data-theme="${theme}" data-brand="${brand}"><style>${css}</style><body><button class="btn btn-primary" id="b">x</button><i id="f" style="color:var(--focus)"></i><i id="r" style="color:var(--brand)"></i></body></html>`);
      await page.keyboard.press('Tab');
      const v = await page.evaluate(() => {
        const c = (id) => getComputedStyle(document.getElementById(id)).color;
        const b = document.getElementById('b');
        return { focus: c('f'), brand: c('r'), outline: getComputedStyle(b).outlineColor, fv: b.matches(':focus-visible') };
      });
      const okBlue = theme === 'light' ? v.focus === BLUES.light : BLUES.dark.includes(v.focus);
      const ok = okBlue && v.focus !== v.brand && v.fv && v.outline === v.focus && !REDS.includes(v.outline);
      if (!ok) fail++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${theme}/${brand} focus=${v.focus} brand=${v.brand} outline=${v.outline}`);
    }
  }
  await browser.close();
  console.log(fail ? `FAIL ${fail}` : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})();
