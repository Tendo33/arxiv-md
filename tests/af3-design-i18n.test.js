/**
 * AF3 设计验收：不完整通知本地化（_locales）+ 文案
 */
import fs from 'fs';
import path from 'path';
import { translations } from '../src/config/locales';

const LOC = path.join(__dirname, '..', 'src', '_locales');
const load = (lang) => JSON.parse(fs.readFileSync(path.join(LOC, lang, 'messages.json'), 'utf8'));

// storage.js 导入时会实例化单例并读 chrome.storage.sync，先放一个最小 chrome 再 require
global.chrome = { storage: { sync: {} }, i18n: { getUILanguage: () => 'en-US' } };
const { incompleteNotification } = require('../src/core/converter/incomplete-notification');

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

  // 浏览器 UI 语言与设置语言相反，断言通知用的是设置里的语言
  const withUiLang = (ui, fn) => {
    const prev = global.chrome;
    global.chrome = { i18n: { getUILanguage: () => ui, getMessage: () => 'UI-LOCALE' } };
    try { return fn(); } finally { global.chrome = prev; }
  };
  const zh = { title: '\u26a0 导出可能不完整', message: '约 58 个标题只导出了 25 个，请核对。\n已保存：paper.md' };
  const en = { title: '\u26a0 Export may be incomplete', message: 'Only 25 of ~58 headings exported — please check.\nSaved: paper.md' };

  test('设置为 zh（浏览器是 en-US）→ 中文通知，先写缺失再写文件名', () => {
    expect(withUiLang('en-US', () => incompleteNotification(args, 'zh'))).toEqual(zh);
  });

  test('设置为 en（浏览器是 zh-CN）→ 英文通知', () => {
    expect(withUiLang('zh-CN', () => incompleteNotification(args, 'en'))).toEqual(en);
  });

  test.each([undefined, null, 'auto'])('未设置/自动（%s）→ 按浏览器默认规则', (lang) => {
    expect(withUiLang('zh-CN', () => incompleteNotification(args, lang))).toEqual(zh);
    expect(withUiLang('en-US', () => incompleteNotification(args, lang))).toEqual(en);
  });

  test('locales.js 的 notify_incomplete_* 与 _locales 同名 key 一致', () => {
    const conv = (m) => m.replace('$EXPECTED$', '{expected}').replace('$ACTUAL$', '{actual}').replace('$FILENAME$', '{filename}');
    for (const [l, dir] of [['en', 'en'], ['zh', 'zh_CN']]) {
      expect(translations[l].notify_incomplete_title).toBe(load(dir).notify_incomplete_title.message);
      expect(translations[l].notify_incomplete_body).toBe(conv(load(dir).notify_incomplete_body.message));
    }
  });

  test('后台接线：不完整通知走 incompleteNotification，不再写死中文', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'converter', 'index.js'), 'utf8');
    expect(src).toMatch(/const lang = await storage\.getLanguage\(\)[\s\S]{0,400}incompleteNotification\([\s\S]*?\}, lang\)/);
    expect(src).not.toMatch(/导出可能不完整/);
  });

  test('所有不完整文案：不带 U+FE0F，不出现「后半部分」/ later sections', () => {
    const texts = [
      ...['en', 'zh_CN'].flatMap((l) => [load(l).notify_incomplete_title.message, load(l).notify_incomplete_body.message]),
      ...['en', 'zh'].flatMap((l) => [translations[l].content_progress_incomplete, translations[l].content_result_incomplete,
        translations[l].notify_incomplete_title, translations[l].notify_incomplete_body]),
      fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'converter', 'incomplete-notification.js'), 'utf8'),
    ];
    for (const s of texts) {
      expect(s).not.toMatch(/\uFE0F/);
      expect(s).not.toMatch(/后半部分/);
      expect(s).not.toMatch(/later sections/i);
    }
  });
});
