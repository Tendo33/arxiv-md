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

test('firefox：manifest 与源文件完全一致', () => {
  expect(manifestForTarget(src, 'firefox')).toEqual(src);
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
