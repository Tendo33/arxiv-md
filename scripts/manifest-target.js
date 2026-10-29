// 按目标浏览器调整构建产物里的 manifest。
// Chrome 对 MV3 的 background.scripts 报「'background.scripts' requires manifest version of 2 or lower」，
// 所以 Chrome/Edge 包去掉 scripts；Firefox 不支持 service_worker，Firefox 包保留 scripts。
const TARGETS = ['chrome', 'firefox'];
const FIREFOX_REQUIRED_DNR = 'declarativeNetRequestWithHostAccess';

// 只有「没给」（undefined/null）才默认 chrome；给了空值（--env target= / --target=）、
// 非字符串（--env target → true）或未知值都报错，不能悄悄构建成 Chrome 包
function normalizeTarget(target) {
  if (target === undefined || target === null) return 'chrome';
  if (typeof target !== 'string') throw new Error(`target 必须写成 target=chrome 或 target=firefox（收到 ${target}）`);
  if (!target.trim()) throw new Error('target 为空，只支持 chrome / firefox');
  const t = target.trim().toLowerCase();
  if (!TARGETS.includes(t)) throw new Error(`未知的 target=${target}，只支持 chrome / firefox`);
  return t;
}

// verify-dist 的参数：[distDir] [--target=chrome|firefox]。
// 空格写法（--target firefox）会把 firefox 当成目录、按 chrome 校验，所以直接报错；未知参数、多个目录也报错
function parseVerifyArgs(argv) {
  let target;
  const dirs = [];
  for (const a of argv) {
    if (a === '--target') throw new Error('请写成 --target=chrome 或 --target=firefox（不支持空格写法）');
    if (a.startsWith('--target=')) {
      if (target !== undefined) throw new Error('--target 只能给一次');
      target = normalizeTarget(a.slice(9));
    } else if (a.startsWith('-')) {
      throw new Error(`未知参数 ${a}`);
    } else {
      dirs.push(a);
    }
  }
  if (dirs.length > 1) throw new Error(`只能指定一个产物目录，收到：${dirs.join(' ')}`);
  return { target: target || 'chrome', dist: dirs[0] || 'dist' };
}

function manifestForTarget(manifest, target) {
  const t = normalizeTarget(target);
  const out = JSON.parse(JSON.stringify(manifest));
  if (t === 'chrome' && out.background) delete out.background.scripts;
  // FF-01 方案 A（Simon 10-29 22:49）：Firefox 包把 DNR 权限改成安装时必需，Chrome 包不变。其它权限一个不动
  if (t === 'firefox') {
    const opt = out.optional_permissions || [];
    if (opt.includes(FIREFOX_REQUIRED_DNR)) {
      out.optional_permissions = opt.filter((p) => p !== FIREFOX_REQUIRED_DNR);
      if (!out.optional_permissions.length) delete out.optional_permissions;
      out.permissions = [...(out.permissions || []), FIREFOX_REQUIRED_DNR];
    }
  }
  return out;
}

function verifyBackground(manifest, target) {
  const t = normalizeTarget(target);
  const errors = [];
  const scripts = manifest.background && manifest.background.scripts;
  if (t === 'firefox') {
    if (!Array.isArray(scripts) || !scripts.length) errors.push('Firefox 产物缺少 background.scripts（Firefox 不支持 service_worker）');
  } else {
    if (scripts !== undefined) errors.push('Chrome/Edge 产物不能有 background.scripts（MV3 下 Chrome 会报错）');
    if (!(manifest.background && manifest.background.service_worker)) errors.push('Chrome/Edge 产物缺少 background.service_worker');
  }
  return errors;
}

// webpack-cli 会把 `--env target=`（空值）整个丢掉，env 里看不到 target，于是默认成 chrome。
// 在 webpack.config 里直接看命令行：出现空的 target= 就报错
function assertEnvTargetNotEmpty(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const v = a.startsWith('--env=') ? a.slice(6) : (argv[i - 1] === '--env' ? a : null);
    if (v !== null && /^target=\s*$/.test(v)) throw new Error('--env target= 为空，只支持 chrome / firefox');
  }
}

module.exports = { TARGETS, FIREFOX_REQUIRED_DNR, normalizeTarget, parseVerifyArgs, assertEnvTargetNotEmpty, manifestForTarget, verifyBackground };
