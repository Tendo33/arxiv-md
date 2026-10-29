/**
 * fix/chrome-bg-scripts：Chrome/Edge 包去掉 background.scripts，Firefox 包保留。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const root = path.join(__dirname, '..');
const { manifestForTarget, verifyBackground } = require('../scripts/manifest-target');
const src = JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8'));

test('chrome：只去掉 background.scripts，其他字段不变', () => {
  const m = manifestForTarget(src, 'chrome');
  expect(m.background).toEqual({ service_worker: src.background.service_worker });
  const { background: _a, ...restSrc } = src;
  const { background: _b, ...restOut } = m;
  expect(restOut).toEqual(restSrc);
  expect(src.background.scripts).toBeDefined(); // 不改原对象
  expect(verifyBackground(m, 'chrome')).toEqual([]);
});

test('firefox：manifest 与源文件只差 FF-01 A 的 DNR 权限位置', () => {
  const { optional_permissions: _o, permissions, ...rest } = manifestForTarget(src, 'firefox');
  const { optional_permissions: _so, permissions: sp, ...srest } = src;
  expect(rest).toEqual(srest);
  expect(permissions).toEqual([...sp, 'declarativeNetRequestWithHostAccess']);
  expect(verifyBackground(src, 'firefox')).toEqual([]);
});

test('verifyBackground 的失败情况', () => {
  expect(verifyBackground({ background: { service_worker: 'b.js', scripts: ['b.js'] } }, 'chrome'))
    .toEqual(['Chrome/Edge 产物不能有 background.scripts（MV3 下 Chrome 会报错）']);
  expect(verifyBackground({ background: { service_worker: 'b.js', scripts: [] } }, 'chrome')).toHaveLength(1);
  expect(verifyBackground({ background: {} }, 'chrome')).toEqual(['Chrome/Edge 产物缺少 background.service_worker']);
  expect(verifyBackground({ background: { service_worker: 'b.js' } }, 'firefox'))
    .toEqual(['Firefox 产物缺少 background.scripts（Firefox 不支持 service_worker）']);
  expect(() => manifestForTarget(src, 'safari')).toThrow(/未知的 target/);
});

test('webpack 配置：manifest 经 manifestForTarget 处理，firefox 输出到 dist-firefox', () => {
  const cfg = fs.readFileSync(path.join(root, 'webpack.config.js'), 'utf8');
  expect(cfg).toMatch(/manifestForTarget\(/);
  expect(cfg).toContain('dist-firefox');
});

test('verify-dist CLI：Chrome 产物带 scripts 时以 1 退出，--target=firefox 时通过', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arxiv md dist '));
  const run = (...a) => spawnSync(process.execPath, [path.join(root, 'scripts/verify-dist.js'), dir, ...a], { encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(src));
  let r = run();
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/不能有 background\.scripts/);
  r = run('--target=firefox');
  expect(r.status).toBe(0);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifestForTarget(src, 'chrome')));
  r = run();
  expect(r.status).toBe(0);
  expect(r.stdout).toMatch(/verify:dist 通过（target: chrome）/);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('构建 / 校验参数加固：空值、空格写法、未知值都报错，不悄悄当成 chrome', () => {
  const { normalizeTarget, parseVerifyArgs } = require('../scripts/manifest-target');
  const webpackConfig = require('../webpack.config.js');
  test('normalizeTarget：只有没给才默认 chrome', () => {
    expect(normalizeTarget(undefined)).toBe('chrome');
    expect(normalizeTarget('Firefox')).toBe('firefox');
    expect(() => normalizeTarget('')).toThrow(/为空/);
    expect(() => normalizeTarget('  ')).toThrow(/为空/);
    expect(() => normalizeTarget(true)).toThrow(/target=chrome 或 target=firefox/); // webpack --env target
    expect(() => normalizeTarget('edge')).toThrow(/未知的 target=edge/);
  });
  test('webpack 配置：--env target= / --env target / 未知值抛错；不给 → dist/', () => {
    expect(() => webpackConfig({ target: '' }, { mode: 'production' })).toThrow(/为空/);
    expect(() => webpackConfig({ target: true }, { mode: 'production' })).toThrow();
    expect(() => webpackConfig({ target: 'safari' }, { mode: 'production' })).toThrow(/未知/);
    expect(webpackConfig({}, { mode: 'production' }).output.path).toBe(path.join(root, 'dist'));
    expect(webpackConfig({ target: 'firefox' }, { mode: 'production' }).output.path).toBe(path.join(root, 'dist-firefox'));
  });
  test('assertEnvTargetNotEmpty：webpack-cli 会丢掉空的 --env target=', () => {
    const { assertEnvTargetNotEmpty } = require('../scripts/manifest-target');
    expect(() => assertEnvTargetNotEmpty(['node', 'webpack', '--env', 'target='])).toThrow(/为空/);
    expect(() => assertEnvTargetNotEmpty(['node', 'webpack', '--env=target='])).toThrow(/为空/);
    expect(() => assertEnvTargetNotEmpty(['node', 'webpack', '--env', 'target=firefox'])).not.toThrow();
    expect(() => assertEnvTargetNotEmpty(['node', 'webpack', '--mode', 'production'])).not.toThrow();
  });
  test('parseVerifyArgs', () => {
    expect(parseVerifyArgs([])).toEqual({ target: 'chrome', dist: 'dist' });
    expect(parseVerifyArgs(['dist-firefox', '--target=firefox'])).toEqual({ target: 'firefox', dist: 'dist-firefox' });
    expect(() => parseVerifyArgs(['dist-firefox', '--target', 'firefox'])).toThrow(/空格写法/);
    expect(() => parseVerifyArgs(['--target='])).toThrow(/为空/);
    expect(() => parseVerifyArgs(['--target=edge'])).toThrow(/未知/);
    expect(() => parseVerifyArgs(['--tagret=firefox'])).toThrow(/未知参数/);
    expect(() => parseVerifyArgs(['a', 'b'])).toThrow(/只能指定一个/);
    expect(() => parseVerifyArgs(['--target=chrome', '--target=firefox'])).toThrow(/只能给一次/);
  });
  test('verify-dist CLI：空格写法 / 空值 / 未知值 → exit 1', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arxiv md dist '));
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(src)); // firefox 产物
    const run = (...a) => spawnSync(process.execPath, [path.join(root, 'scripts/verify-dist.js'), dir, ...a], { encoding: 'utf8' });
    for (const bad of [['--target', 'firefox'], ['--target='], ['--target=edge']]) {
      const r = run(...bad);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/verify:dist 失败/);
      expect(r.stdout).not.toMatch(/通过/);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  test('CI build job 跑两种包的 verify:dist', () => {
    const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/run: npm run build\n\s*#[^\n]*\n\s*- run: npm run verify:dist\n\s*- run: npm run build:firefox\n\s*- run: npm run verify:dist:firefox/);
  });
});
