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
(fs.existsSync(path.join(dist, 'manifest.json')) ? test : test.skip)('dist：_locales 已拷入且与 src 一致（未构建时跳过，先 npm run build）', () => {
  expect(checkLocales(dist).errors).toEqual([]);
  expect(localeDirs(dist).sort()).toEqual(localeDirs(path.join(root, 'src')).sort());
});
if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
  // eslint-disable-next-line no-console
  console.warn('manifest-locales: dist/ 不存在，跳过 dist/_locales 校验；运行 npm run build 后再跑');
}

test('反例：缺 key 或缺 default_locale 目录时报错', () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'loc-'));
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({ default_locale: 'en', description: '__MSG_extDescription__', name: '__MSG_extName__' }));
  fs.mkdirSync(path.join(tmp, '_locales/zh_CN'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '_locales/zh_CN/messages.json'), JSON.stringify({ extDescription: { message: 'x' } }));
  const { errors } = checkLocales(tmp);
  expect(errors).toEqual(expect.arrayContaining(['缺少 _locales/en/messages.json', '_locales/zh_CN 缺少 extName']));
  fs.rmSync(tmp, { recursive: true, force: true });
});
