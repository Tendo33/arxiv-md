// 复审建议 2：action-badge 默认 timers 的箭头包装。严格桩模拟 Chrome：this 不是 globalThis/undefined 就抛 Illegal invocation。
// 桩在 import 之前装上——若默认值改回模块级 { setTimeout, clearTimeout }，对象方法调用时 this 是该对象，测试失败。
const realST = globalThis.setTimeout; const realCT = globalThis.clearTimeout;
let calls; let thrown;
function strictSetTimeout(fn, ms) {
  if (this !== undefined && this !== globalThis) { thrown.push('setTimeout'); throw new TypeError('Illegal invocation'); }
  calls.push({ fn, ms }); return calls.length;
}
function strictClearTimeout() {
  if (this !== undefined && this !== globalThis) { thrown.push('clearTimeout'); throw new TypeError('Illegal invocation'); }
}
beforeEach(() => { calls = []; thrown = []; globalThis.setTimeout = strictSetTimeout; globalThis.clearTimeout = strictClearTimeout; });
afterEach(() => { globalThis.setTimeout = realST; globalThis.clearTimeout = realCT; });

test('不注入 timers：「!」挂上 6000 ms 清除计时器，触发后徽标清空，无 Illegal invocation', () => {
  let mod;
  jest.isolateModules(() => { mod = require('../src/background/action-badge'); });
  const state = {};
  const action = { setBadgeText: ({ tabId, text }) => { state[tabId] = text; }, setBadgeBackgroundColor: () => {} };
  const badge = mod.createActionBadge(action);
  badge.shortcutStarted(7);
  badge.finish(7, false);
  globalThis.setTimeout = realST; globalThis.clearTimeout = realCT;
  expect(thrown).toEqual([]);
  expect(state[7]).toBe('!');
  const c = calls.find((x) => x.ms === 6000);
  expect(c).toBeTruthy();
  c.fn();
  expect(state[7]).toBe('');
});
