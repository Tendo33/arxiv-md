// 按目标浏览器调整构建产物里的 manifest。
// Chrome 对 MV3 的 background.scripts 报「'background.scripts' requires manifest version of 2 or lower」，
// 所以 Chrome/Edge 包去掉 scripts；Firefox 不支持 service_worker，Firefox 包保留 scripts。
const TARGETS = ['chrome', 'firefox'];

function normalizeTarget(target) {
  const t = String(target || 'chrome').toLowerCase();
  if (!TARGETS.includes(t)) throw new Error(`未知的 target=${target}，只支持 chrome / firefox`);
  return t;
}

function manifestForTarget(manifest, target) {
  const t = normalizeTarget(target);
  const out = JSON.parse(JSON.stringify(manifest));
  if (t === 'chrome' && out.background) delete out.background.scripts;
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

module.exports = { TARGETS, normalizeTarget, manifestForTarget, verifyBackground };
