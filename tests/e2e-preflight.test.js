// batch5：e2e 脚本的环境前置检查——缺 playwright / CHROME_PATH 时给出提示并以 2 退出（不启动浏览器）
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const script = path.join(__dirname, '../scripts/e2e-shortcut.js');
let fake;
const run = (env) => {
  const e = { ...process.env, ...env };
  Object.keys(e).forEach((k) => { if (e[k] === undefined) delete e[k]; });
  return spawnSync(process.execPath, [script], { env: e, encoding: 'utf8' });
};
beforeAll(() => {
  fake = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-fakepw-'));
  fs.mkdirSync(path.join(fake, 'node_modules/playwright'), { recursive: true });
  fs.writeFileSync(path.join(fake, 'package.json'), '{}');
  // batch7：E2E_FAKE_LAUNCH_ERR 设置时 launchPersistentContext 抛这个错，用来模拟启动失败
  fs.writeFileSync(path.join(fake, 'node_modules/playwright/index.js'),
    'module.exports={chromium:{launchPersistentContext:async()=>{throw new Error(process.env.E2E_FAKE_LAUNCH_ERR||"x")}}};');
  fs.writeFileSync(path.join(fake, 'chrome'), '');
  fs.chmodSync(path.join(fake, 'chrome'), 0o755);
  fs.mkdirSync(path.join(fake, 'dist'));
  fs.writeFileSync(path.join(fake, 'dist/manifest.json'), JSON.stringify({ commands: { 'convert-current-paper': { suggested_key: { default: 'Alt+Shift+A' } } } }));
});
afterAll(() => fs.rmSync(fake, { recursive: true, force: true }));

describe('e2e-shortcut 环境前置检查', () => {
  const hasLocalPw = fs.existsSync(path.join(__dirname, '../node_modules/playwright'));
  (hasLocalPw ? test.skip : test)('找不到 playwright：提示并退出 2（不再回落到写死的本机目录）', () => {
    const r = run({ E2E_PLAYWRIGHT_DIR: undefined, CHROME_PATH: undefined });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/找不到 playwright/);
  });
  test('未设置 CHROME_PATH：提示并退出 2', () => {
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: undefined });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/未设置 CHROME_PATH/);
  });
  test('CHROME_PATH 文件不存在：提示并退出 2', () => {
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: path.join(fake, 'no-such-chrome') });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/CHROME_PATH 指向的文件不存在/);
  });
  // batch6 AB5-01：没有 dist/ 时提示先构建，退出 2
  test('没有 dist/：提示请先构建（npm run build）并退出 2', () => {
    const chrome = path.join(fake, 'chrome');
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: chrome, DISPLAY: 'localhost:99', E2E_DIST: path.join(fake, 'no-dist') });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/请先构建（npm run build）/);
    expect(r.stderr).not.toMatch(/ENOENT|\n\s+at /);
  });
  // batch6 AB5-02：CHROME_PATH 指向目录 / 没有 DISPLAY 时提示并退出 2，不带堆栈
  test('CHROME_PATH 指向目录：提示并退出 2', () => {
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: fake, DISPLAY: 'localhost:99' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/CHROME_PATH 指向的是目录/);
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
  (process.platform === 'linux' ? test : test.skip)('没有 DISPLAY：提示用 xvfb-run 并退出 2', () => {
    const chrome = path.join(fake, 'chrome');
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: chrome, DISPLAY: undefined, WAYLAND_DISPLAY: undefined });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/没有可用的显示器（DISPLAY 未设置）/);
    expect(r.stderr).toMatch(/xvfb-run/);
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
  // batch7 AB6-01/02/04（对应 zhihu ZB6-01/02/04）
  test('CHROME_PATH 是没有执行权限的文件：提示并退出 2，不带 EACCES 堆栈', () => {
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: path.join(fake, 'package.json'), DISPLAY: 'localhost:99' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/CHROME_PATH 不是可执行文件/);
    expect(r.stderr).not.toMatch(/EACCES|\n\s+at /);
  });
  (process.platform === 'linux' && !fs.existsSync('/tmp/.X11-unix/X777') ? test : test.skip)('DISPLAY=:777 没有 X server：提示用 xvfb-run 并退出 2', () => {
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: path.join(fake, 'chrome'), DISPLAY: ':777', WAYLAND_DISPLAY: undefined });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/DISPLAY=:777 连接不上/);
    expect(r.stderr).toMatch(/xvfb-run/);
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
  test.each([
    ['XServer', 'browserType.launchPersistentContext: Target page, context or browser has been closed\nLooks like you launched a headed browser without having a XServer running.', /没有可用的 X server/],
    ['EACCES', 'browserType.launchPersistentContext: Failed to launch: Error: spawn /x/chrome EACCES', /CHROME_PATH 不是可执行的 Chrome/],
    ['其他', 'boom', /Chrome 启动失败：boom/],
  ])('启动失败（%s）：中文提示、退出 2、删掉 /tmp/e2e-shortcut-* 临时目录', (_n, err, hint) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-tmp-'));
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: path.join(fake, 'chrome'), DISPLAY: 'localhost:99',
      E2E_DIST: path.join(fake, 'dist'), E2E_FAKE_LAUNCH_ERR: err, TMPDIR: tmp });
    const left = fs.readdirSync(tmp).filter((f) => f.startsWith('e2e-shortcut-'));
    fs.rmSync(tmp, { recursive: true, force: true });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(hint);
    expect(r.stderr).not.toMatch(/\n\s+at /);
    expect(left).toEqual([]);
  });
});

describe('R5-07：DEVELOPMENT.md 写明 e2e 的环境条件', () => {
  test('提到 E2E_PLAYWRIGHT_DIR、CHROME_PATH、xvfb-run 和 exit 2', () => {
    const doc = require('fs').readFileSync(require('path').join(__dirname, '../docs/DEVELOPMENT.md'), 'utf8');
    expect(doc).toMatch(/E2E_PLAYWRIGHT_DIR/);
    expect(doc).toMatch(/CHROME_PATH/);
    expect(doc).toMatch(/xvfb-run -a/);
    expect(doc).toMatch(/exit 2/);
  });
});
