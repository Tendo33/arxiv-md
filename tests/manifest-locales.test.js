// manifest 的 __MSG_xxx__ 必须在每个 _locales/*/messages.json 里都有；dist 构建过时还要确认 _locales 被拷进去
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const loadManifest = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const msgKeys = (m) => [...new Set([...JSON.stringify(m).matchAll(/__MSG_(\w+?)__/g)].map((x) => x[1]))];
const localeDirs = (base) => fs.readdirSync(path.join(base, '_locales')).filter((d) => fs.statSync(path.join(base, '_locales', d)).isDirectory());

export function checkLocales(base) {
  const m = loadManifest(base);
  const errors = [];
  const keys = msgKeys(m);
  if (keys.length && !m.default_locale) errors.push('manifest 用了 __MSG_ 但没有 default_locale');
  if (m.default_locale && !fs.existsSync(path.join(base, '_locales', m.default_locale, 'messages.json'))) errors.push(`缺少 _locales/${m.default_locale}/messages.json`);
  if (fs.existsSync(path.join(base, '_locales'))) {
    for (const loc of localeDirs(base)) {
      const f = path.join(base, '_locales', loc, 'messages.json');
      const msgs = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
      for (const k of keys) if (!msgs[k] || !msgs[k].message) errors.push(`_locales/${loc} 缺少 ${k}`);
    }
  }
  return { keys, errors };
}

test('src：每个 __MSG_ key 在所有 locale 里都有，default_locale 目录存在', () => {
  const r = checkLocales(path.join(root, 'src'));
  expect(r.keys).toContain('extDescription');
  expect(r.errors).toEqual([]);
});

const dist = path.join(root, 'dist');
const built = fs.existsSync(path.join(dist, 'manifest.json'));
// 复审 P3-B：CI 里先 build 再 test，dist 缺失说明流程被改坏 → 直接失败，不能静默跳过
const inCI = !!process.env.CI && process.env.CI !== 'false';
(built || inCI ? test : test.skip)('dist：_locales 已拷入且与 src 一致（本地未构建时跳过；CI 必须执行）', () => {
  if (!built) throw new Error('CI=true 但 dist/manifest.json 不存在：ci.yml 须先 npm run build 再 npm test');
  expect(checkLocales(dist).errors).toEqual([]);
  expect(localeDirs(dist).sort()).toEqual(localeDirs(path.join(root, 'src')).sort());
});
if (!built && !inCI) {
  // eslint-disable-next-line no-console
  console.warn('manifest-locales: dist/ 不存在，跳过 dist/_locales 校验；运行 npm run build 后再跑');
}

test('ci.yml：build 在 test 之前（dist 校验才会真正执行）', () => {
  const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const b = ci.indexOf('npm run build');
  const t = ci.indexOf('npm test');
  expect(b).toBeGreaterThan(-1);
  expect(t).toBeGreaterThan(b);
});

test('反例：缺 key 或缺 default_locale 目录时报错', () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'loc-'));
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({ default_locale: 'en', description: '__MSG_extDescription__', name: '__MSG_extName__' }));
  fs.mkdirSync(path.join(tmp, '_locales/zh_CN'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '_locales/zh_CN/messages.json'), JSON.stringify({ extDescription: { message: 'x' } }));
  const { errors } = checkLocales(tmp);
  expect(errors).toEqual(expect.arrayContaining(['缺少 _locales/en/messages.json', '_locales/zh_CN 缺少 extName']));
  fs.rmSync(tmp, { recursive: true, force: true });
});
