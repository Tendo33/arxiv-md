// AR-06：把打进包里的第三方依赖许可证合并成一个 THIRD_PARTY_NOTICES.txt，
// 取代 Terser 生成的 *.js.LICENSE.txt（配合 extractComments: false）。
const fs = require('fs');
const path = require('path');

const LICENSE_FILES = /^(licen[cs]e|copying)(\.(md|txt))?$/i;

function packageRoot(file) {
  const parts = file.split(path.sep);
  const i = parts.lastIndexOf('node_modules');
  if (i < 0) return null;
  const n = parts[i + 1] && parts[i + 1].startsWith('@') ? 3 : 2;
  return parts.slice(0, i + n).join(path.sep);
}

function collect(roots) {
  const out = [];
  for (const root of [...roots].sort()) {
    const pkgFile = path.join(root, 'package.json');
    if (!fs.existsSync(pkgFile)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const lic = fs.readdirSync(root).find((f) => LICENSE_FILES.test(f));
    const text = lic ? fs.readFileSync(path.join(root, lic), 'utf8').trim() : `License: ${pkg.license || 'UNKNOWN'}`;
    out.push({ name: pkg.name, version: pkg.version, license: pkg.license, text });
  }
  const seen = new Set();
  return out.filter((p) => !seen.has(`${p.name}@${p.version}`) && seen.add(`${p.name}@${p.version}`));
}

function render(pkgs) {
  const head = 'arXiv-MD bundles the following third-party software.\n';
  return head + pkgs.map((p) => `\n${'='.repeat(72)}\n${p.name}@${p.version} (${p.license || 'see below'})\n${'='.repeat(72)}\n\n${p.text}\n`).join('');
}

class ThirdPartyNoticesPlugin {
  apply(compiler) {
    const { RawSource } = compiler.webpack.sources;
    compiler.hooks.thisCompilation.tap('ThirdPartyNotices', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'ThirdPartyNotices', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          // Babel 内联的 helpers（含 regenerator-runtime）不是独立模块，单独补上
          const roots = new Set([path.join(compiler.context, 'node_modules', '@babel', 'helpers')]);
          for (const m of compilation.modules) {
            const res = m.resource || (m.rootModule && m.rootModule.resource);
            const inner = m.modules ? m.modules.map((x) => x.resource) : [];
            for (const r of [res, ...inner]) {
              const root = r && packageRoot(r);
              if (root) roots.add(root);
            }
          }
          compilation.emitAsset('THIRD_PARTY_NOTICES.txt', new RawSource(render(collect(roots))));
        },
      );
    });
  }
}

module.exports = { ThirdPartyNoticesPlugin, packageRoot, collect, render };
