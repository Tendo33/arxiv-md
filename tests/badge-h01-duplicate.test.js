// H-01（管理员定）：重复 MinerU 任务清除徽标、不显示「✓」；用户取消清除；强制提交失败显示「!」
import fs from 'fs';
import path from 'path';
import { createActionBadge, handleShortcutResult } from '../src/background/action-badge';

const mkAction = () => {
  const state = {};
  return { state,
    setBadgeText: jest.fn(({ tabId, text }) => { state[tabId] = { ...state[tabId], text }; return Promise.resolve(); }),
    setBadgeBackgroundColor: jest.fn(() => Promise.resolve()) };
};
const mk = () => {
  const a = mkAction(); const t = [];
  const badge = createActionBadge(a, { setTimeout: (fn, ms) => { t.push([fn, ms]); return t.length; }, clearTimeout: () => {} });
  return { a, t, badge };
};
const me = (id) => ({ id: 'me', tab: { id } });

test('duplicate → hold：「…」被清掉，不出现「✓」，仍在跟踪', () => {
  const { a, badge } = mk();
  badge.shortcutStarted(1);
  expect(badge.hold(1)).toBe(true);
  expect(a.state[1].text).toBe('');
  expect(a.setBadgeText.mock.calls.map(([x]) => x.text)).not.toContain('✓');
  expect(badge.isTracking(1)).toBe(true);
});

test('用户取消（SHORTCUT_RESULT clear）→ 清除并停止跟踪，不显示任何结果', () => {
  const { a, badge } = mk();
  badge.shortcutStarted(2); badge.hold(2);
  expect(handleShortcutResult(badge, { clear: true }, me(2), 'me')).toBe(true);
  expect(a.state[2].text).toBe('');
  expect(badge.isTracking(2)).toBe(false);
  expect(a.setBadgeText.mock.calls.map(([x]) => x.text)).not.toContain('✓');
});

test('强制提交失败（SHORTCUT_RESULT ok:false）→「!」，6000 ms 后清除', () => {
  const { a, t, badge } = mk();
  badge.shortcutStarted(3); badge.hold(3);
  expect(handleShortcutResult(badge, { ok: false }, me(3), 'me')).toBe(true);
  expect(a.state[3].text).toBe('!');
  const c = t.filter(([, ms]) => ms === 6000).pop(); c[0]();
  expect(a.state[3].text).toBe('');
});

test('非快捷键发起的转换：hold / clear 不动徽标', () => {
  const { a, badge } = mk();
  expect(badge.hold(4)).toBe(false);
  expect(handleShortcutResult(badge, { clear: true }, me(4), 'me')).toBe(false);
  expect(a.setBadgeText).not.toHaveBeenCalled();
});

describe('content 接线', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/content/index.js'), 'utf8');
  test('强制提交失败分支调用 reportShortcutFailure', () => {
    expect(src).toMatch(/forceResponse\.success\) \{[\s\S]*?reportShortcutClear\(\);\s*\} else \{[\s\S]*?reportShortcutFailure\(\);/);
  });
  test('用户取消分支调用 reportShortcutClear', () => {
    expect(src).toMatch(/cancelled: true \}\);\s*reportShortcutClear\(\);/);
  });
  test('progress-ui 的 reportShortcutClear 发出 { type: SHORTCUT_RESULT, clear: true }', () => {
    const sent = [];
    global.chrome = { runtime: { sendMessage: (m) => { sent.push(m); return Promise.resolve(); } } };
    jest.isolateModules(() => { require('../src/content/progress-ui').reportShortcutClear(); });
    expect(sent).toEqual([{ type: 'SHORTCUT_RESULT', clear: true }]);
  });
});
