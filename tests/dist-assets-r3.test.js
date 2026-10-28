import fs from 'fs';
import path from 'path';

test('R3 perf：webpack 只拷图标资源，不打包 README 截图', () => {
  const cfg = fs.readFileSync(path.join(__dirname, '../webpack.config.js'), 'utf8');
  expect(cfg).not.toMatch(/from: "assets", to: "assets"/);
  expect(cfg).toContain('assets/icon-*.png');
  expect(cfg).toContain('assets/icon.svg');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.json'), 'utf8'));
  const refs = JSON.stringify(manifest).match(/assets\/[\w.-]+/g) || [];
  refs.forEach((r) => expect(r).toMatch(/^assets\/icon-\d+\.png$/));
});
