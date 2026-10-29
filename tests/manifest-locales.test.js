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

// 复审 P3②：ci.yml 在 R4 合入时有冲突，下面几项删掉或跳过时 jest 要能发现
describe('ci.yml：e2e 脚本清单、rendered-check、selftest-live 都在', () => {
  const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const lines = ci.split('\n');
  const jobs = lines.filter((l) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l)).map((l) => l.trim().slice(0, -1));
  const jobBody = (name) => {
    const i = lines.findIndex((l) => l === `  ${name}:`);
    if (i < 0) return '';
    const rest = lines.slice(i + 1);
    const end = rest.findIndex((l) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l) || /^\S/.test(l));
    return (end < 0 ? rest : rest.slice(0, end)).join('\n');
  };
  test('E2E_SCRIPTS 含 3 个 e2e 脚本，且循环真的执行它们', () => {
    const i = lines.findIndex((l) => /^\s+E2E_SCRIPTS: \|\s*$/.test(l));
    expect(i).toBeGreaterThan(-1);
    const ind = lines[i].match(/^\s*/)[0].length;
    const items = [];
    for (const l of lines.slice(i + 1)) {
      if (l.trim() && l.match(/^\s*/)[0].length <= ind) break;
      if (l.trim() && !l.trim().startsWith('#')) items.push(l.trim());
    }
    expect(items).toEqual(expect.arrayContaining(['scripts/e2e-shortcut.js', 'scripts/e2e-popup-a11y.js', 'scripts/e2e-popup-tasklist.js']));
    items.forEach((f) => expect(fs.existsSync(path.join(root, f))).toBe(true));
    expect(ci).toMatch(/for s in \$E2E_SCRIPTS; do/);
    // 循环体必须真的在 xvfb 下运行每个脚本（把循环体换成 echo 也要失败）
    expect(ci).toMatch(/xvfb-run -a node "\$s"/);
  });
  test('rendered-check job 存在并校验 markdown-it 版本行', () => {
    expect(jobs).toContain('rendered-check');
    expect(jobBody('rendered-check')).toContain('grep -q "^rendered check: markdown-it ${MARKDOWN_IT_VERSION}, "');
  });
  test('selftest-live job 存在并在 xvfb 下跑 scripts/selftest-live.js', () => {
    expect(jobs).toContain('selftest-live');
    expect(jobBody('selftest-live')).toMatch(/- run: xvfb-run -a node scripts\/selftest-live\.js/);
  });
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
