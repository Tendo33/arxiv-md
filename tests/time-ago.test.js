import { formatTimeAgo } from '../src/utils/time-ago';
import { translations } from '../src/config/locales';

const NOW = Date.UTC(2026, 9, 28, 12);
const ago = (ms) => NOW - ms;
const M = 60000, H = 60 * M, D = 24 * H;

describe('设计验收必须改 2：相对时间单复数', () => {
  test('英文', () => {
    const j = translations.en.popup_time_just_now;
    expect(formatTimeAgo(ago(10000), 'en', j, NOW)).toBe('Just now');
    expect(formatTimeAgo(ago(M), 'en', j, NOW)).toBe('1 minute ago');
    expect(formatTimeAgo(ago(5 * M), 'en', j, NOW)).toBe('5 minutes ago');
    expect(formatTimeAgo(ago(H), 'en', j, NOW)).toBe('1 hour ago');
    expect(formatTimeAgo(ago(3 * H), 'en', j, NOW)).toBe('3 hours ago');
    expect(formatTimeAgo(ago(D), 'en', j, NOW)).toBe('yesterday');
    expect(formatTimeAgo(ago(4 * D), 'en', j, NOW)).toBe('4 days ago');
    expect(formatTimeAgo(ago(M), 'en', j, NOW)).not.toMatch(/1 mins/);
  });
  test('中文', () => {
    const j = translations.zh.popup_time_just_now;
    expect(formatTimeAgo(ago(10000), 'zh', j, NOW)).toBe('刚刚');
    expect(formatTimeAgo(ago(M), 'zh', j, NOW)).toBe('1分钟前');
    expect(formatTimeAgo(ago(5 * M), 'zh', j, NOW)).toBe('5分钟前');
    expect(formatTimeAgo(ago(3 * H), 'zh', j, NOW)).toBe('3小时前');
    expect(formatTimeAgo(ago(D), 'zh', j, NOW)).toBe('昨天');
    expect(formatTimeAgo(ago(4 * D), 'zh', j, NOW)).toBe('4天前');
  });
  test('旧的拼接 key 已移除', () => {
    for (const l of ['en', 'zh']) expect(translations[l].popup_time_mins_ago).toBeUndefined();
  });
});

describe('Round 3 复审：NaN/undefined 防御 + 进位到月、年', () => {
  test('非数值不抛错', () => {
    for (const bad of [undefined, null, NaN, Infinity, '2026-10-01', {}]) {
      // 基于 hotfix A2-02：无效值显示占位「—」
      expect(formatTimeAgo(bad, 'en', 'Just now', NOW)).toBe('—');
      expect(formatTimeAgo(bad, 'zh', '刚刚', NOW)).toBe('—');
    }
    expect(formatTimeAgo(ago(M), 'en', 'Just now', NaN)).toBe('—');
  });
  test('月 / 年', () => {
    expect(formatTimeAgo(ago(29 * D), 'en', 'J', NOW)).toBe('29 days ago');
    expect(formatTimeAgo(ago(30 * D), 'en', 'J', NOW)).toBe('last month');
    expect(formatTimeAgo(ago(75 * D), 'en', 'J', NOW)).toBe('2 months ago');
    expect(formatTimeAgo(ago(364 * D), 'en', 'J', NOW)).toBe('12 months ago');
    expect(formatTimeAgo(ago(365 * D), 'en', 'J', NOW)).toBe('last year');
    expect(formatTimeAgo(ago(800 * D), 'en', 'J', NOW)).toBe('2 years ago');
    expect(formatTimeAgo(ago(75 * D), 'zh', 'J', NOW)).toBe('2个月前');
    expect(formatTimeAgo(ago(400 * D), 'zh', 'J', NOW)).toBe('去年');
    expect(formatTimeAgo(ago(800 * D), 'zh', 'J', NOW)).toBe('2年前');
  });
});
