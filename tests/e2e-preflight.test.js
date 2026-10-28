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
  fs.writeFileSync(path.join(fake, 'node_modules/playwright/index.js'), 'module.exports={chromium:{}};');
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
    fs.writeFileSync(chrome, '');
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: chrome, DISPLAY: ':99', E2E_DIST: path.join(fake, 'no-dist') });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/请先构建（npm run build）/);
    expect(r.stderr).not.toMatch(/ENOENT|\n\s+at /);
  });
  // batch6 AB5-02：CHROME_PATH 指向目录 / 没有 DISPLAY 时提示并退出 2，不带堆栈
  test('CHROME_PATH 指向目录：提示并退出 2', () => {
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: fake, DISPLAY: ':99' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/CHROME_PATH 指向的是目录/);
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
  (process.platform === 'linux' ? test : test.skip)('没有 DISPLAY：提示用 xvfb-run 并退出 2', () => {
    const chrome = path.join(fake, 'chrome');
    fs.writeFileSync(chrome, '');
    const r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: chrome, DISPLAY: undefined, WAYLAND_DISPLAY: undefined });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/没有可用的显示器（DISPLAY 未设置）/);
    expect(r.stderr).toMatch(/xvfb-run/);
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
});
