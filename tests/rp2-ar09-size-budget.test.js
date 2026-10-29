// rp2 AR-09：只把已知大包 background.js 移出默认 244 KiB 检查，并给它单独 500 KiB 预算
const cfg = require('../webpack.config.js')({}, { mode: 'production' });

test('performance 仍是 warning，未全局关闭，也没有全局抬高上限', () => {
  expect(cfg.performance.hints).toBe('warning');
  expect(cfg.performance.maxAssetSize).toBeUndefined();
  expect(cfg.performance.maxEntrypointSize).toBeUndefined();
});
test('assetFilter 只排除 background.js', () => {
  const f = cfg.performance.assetFilter;
  expect(f('background.js')).toBe(false);
  for (const n of ['content.js', 'popup.js', 'settings.js', 'new-entry.js']) expect(f(n)).toBe(true);
  expect(f('background.js.map')).toBe(false);
});
function runBudget(size) {
  const plugin = cfg.plugins.find((p) => p.constructor.name === 'BackgroundBudgetPlugin');
  expect(plugin).toBeTruthy();
  const warnings = [];
  let cb;
  const compilation = { warnings, hooks: { processAssets: { tap: (_o, fn) => { cb = fn; } } } };
  plugin.apply({ hooks: { thisCompilation: { tap: (_n, fn) => fn(compilation) } } });
  cb({ 'background.js': { size: () => size } });
  return warnings;
}
test('background.js 未超 500 KiB 不告警', () => expect(runBudget(445360)).toHaveLength(0));
test('background.js 超 500 KiB 告警', () => {
  const w = runBudget(500 * 1024 + 1);
  expect(w).toHaveLength(1);
  expect(String(w[0].message)).toMatch(/background\.js .* exceeds its 500 KiB budget/);
});
