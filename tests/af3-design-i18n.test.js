/**
 * AF3 设计验收：不完整通知本地化（_locales）+ 文案
 */
import fs from 'fs';
import path from 'path';
import { incompleteNotification } from '../src/core/converter/incomplete-notification';
import { translations } from '../src/config/locales';

const LOC = path.join(__dirname, '..', 'src', '_locales');
const load = (lang) => JSON.parse(fs.readFileSync(path.join(LOC, lang, 'messages.json'), 'utf8'));

// 按 Chrome 规则展开 $NAME$ → placeholders[name].content → $n
function fakeI18n(lang) {
  const msgs = load(lang);
  return {
    getMessage(key, subs = []) {
      const m = msgs[key];
      if (!m) return '';
      return m.message.replace(/\$([a-z0-9_]+)\$/gi, (_, name) => {
        const ph = m.placeholders && m.placeholders[name.toLowerCase()];
        return ph ? ph.content.replace(/\$(\d)/g, (__, i) => subs[Number(i) - 1]) : '';
      });
    },
  };
}

const args = { expected: 58, actual: 25, filename: 'paper.md' };

describe('AF3 设计验收：_locales', () => {
  test.each(['en', 'zh_CN'])('%s 有 notify_incomplete_title / notify_incomplete_body', (lang) => {
    const m = load(lang);
    expect(m.notify_incomplete_title.message).toBeTruthy();
    expect(m.notify_incomplete_body.message).toBeTruthy();
    expect(Object.keys(m.notify_incomplete_body.placeholders).sort()).toEqual(['actual', 'expected', 'filename']);
  });

  test('en 与 zh_CN 的 key 集合一致', () => {
    expect(Object.keys(load('en')).sort()).toEqual(Object.keys(load('zh_CN')).sort());
  });

  test('中文通知：单色 ⚠，先写缺失，再写文件名', () => {
    const n = incompleteNotification(args, fakeI18n('zh_CN'));
    expect(n.title).toBe('\u26a0 导出可能不完整');
    expect(n.message).toBe('约 58 个标题只导出了 25 个，请核对。\n已保存：paper.md');
  });

  test('英文通知', () => {
    const n = incompleteNotification(args, fakeI18n('en'));
    expect(n.title).toBe('\u26a0 Export may be incomplete');
    expect(n.message).toBe('Only 25 of ~58 headings exported — please check.\nSaved: paper.md');
  });

  test('chrome.i18n 不可用时退回中文', () => {
    expect(incompleteNotification(args, undefined)).toEqual(incompleteNotification(args, fakeI18n('zh_CN')));
  });

  test('后台接线：不完整通知走 incompleteNotification，不再写死中文', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'converter', 'index.js'), 'utf8');
    expect(src).toMatch(/incompleteNotification\(/);
    expect(src).not.toMatch(/导出可能不完整/);
  });

  test('所有不完整文案：不带 U+FE0F，不出现「后半部分」/ later sections', () => {
    const texts = [
      ...['en', 'zh_CN'].flatMap((l) => [load(l).notify_incomplete_title.message, load(l).notify_incomplete_body.message]),
      ...['en', 'zh'].flatMap((l) => [translations[l].content_progress_incomplete, translations[l].content_result_incomplete]),
      fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'converter', 'incomplete-notification.js'), 'utf8'),
    ];
    for (const s of texts) {
      expect(s).not.toMatch(/\uFE0F/);
      expect(s).not.toMatch(/后半部分/);
      expect(s).not.toMatch(/later sections/i);
    }
  });
});
