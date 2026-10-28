// 最终复审 P0：context-menu 默认 timers 不能是脱离 this 的 { setTimeout, clearTimeout }（Chrome 报 Illegal invocation）。
// 不注入 timers；import 之前把 globalThis.setTimeout/clearTimeout 换成检查 this 的严格桩。
const realST = globalThis.setTimeout; const realCT = globalThis.clearTimeout;
let calls; let cleared; let thrown;
function strictSetTimeout(fn, ms) {
  if (this !== undefined && this !== globalThis) { thrown.push('setTimeout'); throw new TypeError('Illegal invocation'); }
  calls.push({ fn, ms }); return calls.length;
}
function strictClearTimeout(id) {
  if (this !== undefined && this !== globalThis) { thrown.push('clearTimeout'); throw new TypeError('Illegal invocation'); }
  cleared.push(id);
}
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const mkEvent = () => { const fns = []; return { fns, addListener: (f) => fns.push(f), removeListener: (f) => { const i = fns.indexOf(f); if (i >= 0) fns.splice(i, 1); }, fire: (...a) => fns.slice().forEach((f) => f(...a)) }; };

let createContextMenus;
const onUnhandled = jest.fn();
// 严格桩只在被测代码运行期间生效，断言前还原（否则 jest 自己的计时器也会被桩影响）
const strict = () => { globalThis.setTimeout = strictSetTimeout; globalThis.clearTimeout = strictClearTimeout; };
const restore = () => { globalThis.setTimeout = realST; globalThis.clearTimeout = realCT; };
beforeEach(() => {
  calls = []; cleared = []; thrown = [];
  strict();
  jest.isolateModules(() => { ({ createContextMenus } = require('../src/background/context-menu')); });
  restore();
  process.on('unhandledRejection', onUnhandled);
});
afterEach(() => { restore(); process.off('unhandledRejection', onUnhandled); });

const setup = () => {
  const onUpdated = mkEvent(); const onRemoved = mkEvent();
  const tabs = { onUpdated, onRemoved, create: jest.fn(async () => ({ id: 9, status: 'loading' })), sendMessage: jest.fn(async () => ({})) };
  const badge = { shortcutStarted: jest.fn(), shortcutUndelivered: jest.fn(), fail: jest.fn() };
  // 与 src/background/index.js 一致：不传 timers
  const cm = createContextMenus({ menus: {}, tabs, runtime: {}, storage: {}, isValidArxivId: () => true, badge, loadTimeoutMs: 1000 });
  return { cm, tabs, onUpdated, badge };
};

test('超时计时器挂得上；超时后在发起页显示「!」，无 Illegal invocation', async () => {
  const s = setup();
  strict();
  const p = s.cm.exportLink('2301.00001', { id: 1, index: 0 });
  await tick();
  const c = calls.find((x) => x.ms === 1000);
  if (c) c.fn();
  await tick();
  restore();
  expect(thrown).toEqual([]);
  expect(c).toBeTruthy();
  await expect(p).resolves.toEqual(expect.objectContaining({ ok: false, reason: 'timeout' }));
  expect(s.badge.fail).toHaveBeenCalledWith(1);
  expect(onUnhandled).not.toHaveBeenCalled();
});

test('按时加载完成：clearTimeout 以正确的 this 调用，清掉超时', async () => {
  const s = setup();
  strict();
  const p = s.cm.exportLink('2301.00001', { id: 1, index: 0 });
  await tick();
  s.onUpdated.fire(9, { status: 'complete' });
  await tick();
  restore();
  await expect(p).resolves.toEqual({ ok: true, tabId: 9 });
  expect(thrown).toEqual([]);
  expect(cleared).toEqual([1]);
  expect(s.badge.fail).not.toHaveBeenCalled();
});

test('index.js 仍不注入 timers（默认值即生产路径）', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/background/index.js'), 'utf8');
  const call = src.match(/createContextMenus\(\{[\s\S]*?\}\)/)[0];
  expect(call).not.toMatch(/timers/);
});
