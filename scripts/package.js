const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const buildDir = path.join(root, 'build');
const { version } = require('../package.json');
const zipName = `arxiv-md-v${version}.zip`;
const zipPath = path.join(buildDir, zipName);

if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
  console.error('dist/ is missing. Run npm run build first.');
  process.exit(1);
}

fs.mkdirSync(buildDir, { recursive: true });

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeKB = (archive.pointer() / 1024).toFixed(2);
  console.log(`Package created: build/${zipName} (${sizeKB} KB)`);
  console.log('Load dist/ in chrome://extensions for local development.');
});

archive.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
