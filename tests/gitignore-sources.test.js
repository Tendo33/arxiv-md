// 审查 P0-1：源码目录下的文件不能被 .gitignore 误伤（曾因 output/ 漏提交 pdf-parse-core/src/output）
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(path.relative(root, p));
  }
  return out;
}

test('no source file under src/ or packages/*/src is gitignored', () => {
  const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'packages/pdf-parse-core/src'))];
  let ignored = '';
  try {
    ignored = execFileSync('git', ['check-ignore', '--no-index', ...files], { cwd: root, encoding: 'utf8' });
  } catch (e) {
    ignored = e.stdout || ''; // exit 1 = 没有被忽略的文件
  }
  expect(ignored.trim()).toBe('');
});
