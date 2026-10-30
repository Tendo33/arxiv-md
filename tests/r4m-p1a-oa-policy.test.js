// 1.2.2：PRIVACY「No confirmation prompt」段的每条说法都对得上代码（零确认、零运行时授权）
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const doc = read('PRIVACY.md');

test('文案：选后端并填 Key 即同意；所有入口直接发送；不再有 OA 确认 / 授权请求', () => {
  expect(doc).toContain('**No confirmation prompt.**');
  expect(doc).toContain('Choosing a provider and saving its key in Settings is your consent to send PDFs to that provider.');
  expect(doc).toContain('every way of starting a parse (popup, right-click menu, floating button and keyboard shortcut) sends the PDF right away');
  expect(doc).toContain('no runtime permission request');
  expect(doc).toContain('Without a key, nothing is sent.');
  expect(doc).not.toContain('**Open access.**');
  expect(doc).not.toContain('"Send & parse"');
  expect(doc).not.toMatch(/Awaiting|until you confirm|grant permission|revoke PaddleOCR access|\(optional\)/);
});

test('权限表：PaddleOCR 两个域名和 DNR 都安装时授予，不再标 optional', () => {
  expect(doc).toContain('| `https://paddleocr.aistudio-app.com/*` | Submit PaddleOCR parsing tasks; contacted only when you use PaddleOCR |');
  expect(doc).toContain('| `https://*.bj.bcebos.com/*` |');
  expect(doc).toContain('| `declarativeNetRequestWithHostAccess` |');
  expect(doc).toContain('All permissions are granted once, when you install or update the extension. The extension never asks for more permissions while you use it.');
});

test('「所有入口直接发送」属实：src 里只有 parse-task-runner 调 provider.submit，前面只有 Key 检查', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const callers = walk(path.join(root, 'src')).filter((f) => f.endsWith('.js') && /provider\.submit\(/.test(fs.readFileSync(f, 'utf8')));
  expect(callers.map((f) => path.relative(root, f))).toEqual(['src/background/parse-task-runner.js']);
  const runner = read('src/background/parse-task-runner.js');
  const proc = runner.slice(runner.indexOf('async function process('));
  expect(proc).toContain('const key = await storage.getProviderKey(provider.id);');
  expect(proc).not.toMatch(/uploadAllowed|isDisclosureAcked|ensureProviderPermission|notify\(task, 'consent'/);
});

test('源码里不再调用 permissions.request / contains / remove', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'packages/pdf-parse-core/src'))].filter((f) => f.endsWith('.js'));
  const hits = files.filter((f) => /permissions\.(request|contains|remove|onAdded|onRemoved)\b/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  expect(hits).toEqual([]);
});
