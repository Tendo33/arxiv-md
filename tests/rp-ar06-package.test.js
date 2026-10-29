/**
 * release-polish AR-06：包里不带 assets/icon.svg 和 *.LICENSE.txt；
 * 打进包的第三方许可证合并进 THIRD_PARTY_NOTICES.txt。
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = path.join(__dirname, '..');
const { packageRoot, collect, render } = require('../scripts/third-party-notices');

test('webpack：extractComments 关掉、挂 ThirdPartyNoticesPlugin、不拷 icon.svg', () => {
  const cfg = fs.readFileSync(path.join(root, 'webpack.config.js'), 'utf8');
  expect(cfg).toMatch(/new TerserPlugin\(\{ extractComments: false \}\)/);
  expect(cfg).toContain('new ThirdPartyNoticesPlugin()');
  expect(cfg).not.toMatch(/from: "assets\/icon\.svg"/);
});

test('设置页 logo 不再引用 icon.svg', () => {
  const html = fs.readFileSync(path.join(root, 'src/ui/settings/settings.html'), 'utf8');
  expect(html).not.toContain('icon.svg');
  expect(html).toContain('src="assets/icon-128.png"');
});

test('packageRoot 识别普通包和 scoped 包', () => {
  const nm = path.join('/x', 'node_modules');
  expect(packageRoot(path.join(nm, 'linkedom', 'esm', 'a.js'))).toBe(path.join(nm, 'linkedom'));
  expect(packageRoot(path.join(nm, '@babel', 'helpers', 'lib', 'x.js'))).toBe(path.join(nm, '@babel', 'helpers'));
  expect(packageRoot(path.join(nm, 'a', 'node_modules', 'entities', 'lib', 'x.js'))).toBe(path.join(nm, 'a', 'node_modules', 'entities'));
  expect(packageRoot('/src/x.js')).toBeNull();
});

test('collect/render：带包名、版本和许可证原文', () => {
  const pkgs = collect([path.join(root, 'node_modules', 'turndown')]);
  expect(pkgs).toHaveLength(1);
  const txt = render(pkgs);
  expect(txt).toContain(`turndown@${pkgs[0].version} (MIT)`);
  expect(txt).toMatch(/Permission is hereby granted/);
});

const runBuild = process.env.RP_BUILD === '1' ? test : test.skip;
runBuild('（RP_BUILD=1）实际构建：dist 里没有 icon.svg / LICENSE.txt，有合并的许可证', () => {
  execFileSync('npx', ['webpack', '--mode', 'production'], { cwd: root, stdio: 'ignore' });
  const files = fs.readdirSync(path.join(root, 'dist'), { recursive: true }).map(String);
  expect(files.some((f) => f.endsWith('.LICENSE.txt'))).toBe(false);
  expect(files).not.toContain(path.join('assets', 'icon.svg'));
  const notices = fs.readFileSync(path.join(root, 'dist/THIRD_PARTY_NOTICES.txt'), 'utf8');
  for (const name of ['linkedom@', 'turndown@', 'turndown-plugin-gfm@', 'htmlparser2@', '@babel/helpers@']) expect(notices).toContain(name);
}, 120000);
