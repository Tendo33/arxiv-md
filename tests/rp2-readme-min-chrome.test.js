// rp2：README / README_CN 写明的最低 Chrome 版本与 manifest.minimum_chrome_version 一致
import fs from 'fs';
import path from 'path';
const root = path.join(__dirname, '..');
const min = JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8')).minimum_chrome_version;
test('manifest 有 minimum_chrome_version', () => expect(min).toBe('121'));
test('README.md 写明 Requires Chrome {min} or later', () => {
  expect(fs.readFileSync(path.join(root, 'README.md'), 'utf8')).toContain(`Requires Chrome ${min} or later.`);
});
test('README_CN.md 写明 需要 Chrome {min} 或更高版本', () => {
  expect(fs.readFileSync(path.join(root, 'README_CN.md'), 'utf8')).toContain(`需要 Chrome ${min} 或更高版本。`);
});
