// 检查构建产物的 background 字段：Chrome/Edge 包不能有 background.scripts，Firefox 包必须有。
// 用法：node scripts/verify-dist.js [distDir] [--target=chrome|firefox]（默认 dist、chrome）
const fs = require('fs');
const path = require('path');
const { normalizeTarget, verifyBackground } = require('./manifest-target');

const args = process.argv.slice(2);
let target;
try {
  target = normalizeTarget((args.find((a) => a.startsWith('--target=')) || '').slice(9) || 'chrome');
} catch (e) {
  console.error(`verify:dist 失败：${e.message}`);
  process.exit(1);
}
const dist = path.resolve(args.find((a) => !a.startsWith('--')) || 'dist');
const manifestPath = path.join(dist, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`verify:dist 失败：找不到 ${manifestPath}，请先构建`);
  process.exit(1);
}
const errors = verifyBackground(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), target);
if (errors.length) {
  console.error(`verify:dist 失败：background 有 ${errors.length} 个问题（target: ${target}）`);
  errors.forEach((m) => console.error('  - ' + m));
  process.exit(1);
}
console.log(`verify:dist 通过（target: ${target}）：${manifestPath}`);
