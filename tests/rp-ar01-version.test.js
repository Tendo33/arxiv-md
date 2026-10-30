// release-polish AR-01：版本号三处一致（现为 1.2.2）；[Unreleased] 留空，紧跟 1.2.2；1.2.0 中文说明保留
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('package.json / package-lock / manifest 都是 1.2.2', () => {
  const lock = JSON.parse(read('package-lock.json'));
  expect(JSON.parse(read('package.json')).version).toBe('1.2.2');
  expect(lock.version).toBe('1.2.2');
  expect(lock.packages[''].version).toBe('1.2.2');
  expect(JSON.parse(read('src/manifest.json')).version).toBe('1.2.2');
});

test('CHANGELOG：[Unreleased] 为空，紧跟 1.2.2；1.2.0 中文说明保留', () => {
  const md = read('CHANGELOG.md');
  expect(md).toMatch(/## \[Unreleased\]\n\n## \[1\.2\.2\] - \d{4}-\d{2}-\d{2}\n/);
  const m = md.match(/\n## \[1\.2\.0\] - \d{4}-\d{2}-\d{2}\n([\s\S]*?)\n## \[1\.1\.12\]/);
  expect(m).toBeTruthy();
  for (const h of ['### 新增', '### 改进', '### 修复']) expect(m[1]).toContain(h);
  expect(m[1]).toMatch(/[\u4e00-\u9fff]/);
});
