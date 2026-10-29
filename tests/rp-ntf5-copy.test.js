// release-polish 设计 NTF5：中文进行态统一「正在…」+「导出」，按钮名用「」，『』只用于嵌套
import { translations } from '../src/config/locales';
const zh = translations.zh, en = translations.en;

test('进行态统一「正在…」，动词用「导出」', () => {
  expect(zh.popup_badge_run).toBe('正在导出');
  expect(zh.popup_converting).toBe('正在导出…');
  expect(zh.content_fab_run).toBe('正在导出…');
  expect(zh.content_progress_checking).toBe('正在检查 HTML…');
  expect(zh.content_progress_processing).toBe('正在处理…');
  expect(zh.content_progress_parsing).toBe('{provider} 正在解析…');
  expect(zh.saving).toBe('正在保存…');
  expect(en.popup_badge_run).toBe('Exporting');
  expect(en.popup_converting).toBe('Exporting…');
});
test('zh 文案里没有「X中…」进行态', () => {
  const bad = Object.entries(zh).filter(([, v]) => typeof v === 'string' && /[\u4e00-\u9fff]中(…|$)/.test(v));
  expect(bad).toEqual([]);
});
test('zh 文案不用弯引号/直引号，『』只出现在「」里面', () => {
  for (const [k, v] of Object.entries(zh)) {
    if (typeof v !== 'string') continue;
    expect([k, /[“”‘’"]/.test(v)]).toEqual([k, false]);
    let depth = 0;
    for (const ch of v) {
      if (ch === '「') depth++;
      if (ch === '」') depth--;
      if (ch === '『') expect([k, depth > 0]).toEqual([k, true]);
    }
  }
});
