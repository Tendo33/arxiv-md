#!/usr/bin/env node
// R4-16：源码和 dist 里不能出现字面量 Key（sk-…、Bearer 加长串、JWT）。用法：node scripts/check-no-keys.js [目录…]
const fs = require('fs');
const path = require('path');

const PATTERNS = [
  { name: 'sk- key', re: /\bsk-[A-Za-z0-9_-]{16,}/g },
  { name: 'Bearer literal', re: /Bearer [A-Za-z0-9._~+/=-]{20,}/g },
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
];
const EXT = /\.(m?js|json|html|css|md|txt)$/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.test(e.name)) out.push(p);
  }
  return out;
}

function scan(dirs) {
  const hits = [];
  for (const file of dirs.flatMap((d) => walk(d, []))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const { name, re } of PATTERNS) {
      for (const m of text.matchAll(re)) hits.push({ file, name, sample: `${m[0].slice(0, 12)}…` });
    }
  }
  return hits;
}

module.exports = { scan, PATTERNS };

if (require.main === module) {
  const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['src', 'packages/pdf-parse-core/src', 'dist'];
  const hits = scan(dirs);
  if (hits.length) {
    hits.forEach((h) => console.error(`${h.file}: ${h.name} ${h.sample}`));
    process.exit(1);
  }
  console.log(`check-no-keys: OK (${dirs.join(', ')})`);
}
