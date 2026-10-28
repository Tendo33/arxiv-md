import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { detectBrowser, shortcutGuide, renderShortcutGuide, SHORTCUT_COMMAND } from '../src/ui/popup/shortcut-guide';
import { translations } from '../src/config/locales';

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
};
const URLS = { chrome: 'chrome://extensions/shortcuts', edge: 'edge://extensions/shortcuts', firefox: null };
const SET = [{ name: SHORTCUT_COMMAND, shortcut: 'Alt+Shift+M' }];
const EMPTY = [{ name: SHORTCUT_COMMAND, shortcut: '' }];
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('src/ui/popup/popup.html');
const doc = () => parseHTML(html).document;

describe('快捷键未设置引导', () => {
  test('manifest 默认键保持 Alt+Shift+M，且不新增 tabs 权限', () => {
    const m = JSON.parse(read('src/manifest.json'));
    expect(m.commands[SHORTCUT_COMMAND].suggested_key).toEqual({ default: 'Alt+Shift+M', mac: 'Alt+Shift+M' });
    expect(m.permissions).not.toContain('tabs');
  });
  test('中英文案齐全', () => {
    for (const k of ['popup_shortcut_unset', 'popup_shortcut_setup', 'popup_shortcut_firefox_hint']) {
      expect(translations.zh[k]).toBeTruthy(); expect(translations.en[k]).toBeTruthy();
    }
    expect(translations.zh.popup_shortcut_firefox_hint).toBe('在附加组件管理里设置');
    expect(translations.en.popup_shortcut_firefox_hint).toBe('Set it in Add-ons Manager');
  });
  test('命令缺失也视为未设置', () => {
    expect(shortcutGuide([], UA.chrome).set).toBe(false);
    expect(shortcutGuide([{ name: 'x', shortcut: 'Alt+Q' }], UA.chrome).set).toBe(false);
  });

  describe.each(Object.keys(UA))('%s', (b) => {
    const ua = UA[b];
    test('UA 识别', () => expect(detectBrowser(ua)).toBe(b));
    test('快捷键非空：显示 kbd，不显示引导', () => {
      const d = doc(); const opened = [];
      expect(renderShortcutGuide(d, SET, ua, translations.zh, (u) => opened.push(u))).toEqual({ set: true, shortcut: 'Alt+Shift+M' });
      expect(d.getElementById('shortcutKbd').textContent).toBe('Alt+Shift+M');
      expect(d.getElementById('shortcutKbd').classList.contains('hidden')).toBe(false);
      expect(d.getElementById('shortcutGuide').classList.contains('hidden')).toBe(true);
      expect(d.getElementById('shortcutSetup')).toBeNull();
      expect(opened).toEqual([]);
    });
    test.each(['zh', 'en'])('快捷键为空（%s）：显示引导', (lang) => {
      const d = doc(); const opened = []; const tr = translations[lang];
      renderShortcutGuide(d, EMPTY, ua, tr, (u) => opened.push(u));
      const box = d.getElementById('shortcutGuide');
      expect(box.classList.contains('hidden')).toBe(false);
      expect(d.getElementById('shortcutKbd').classList.contains('hidden')).toBe(true);
      expect(d.getElementById('shortcutPrefix').classList.contains('hidden')).toBe(true);
      expect(box.textContent).toContain(tr.popup_shortcut_unset);
      const btn = d.getElementById('shortcutSetup');
      if (b === 'firefox') {
        expect(btn).toBeNull();
        expect(box.textContent).toContain(tr.popup_shortcut_firefox_hint);
      } else {
        expect(btn.tagName).toBe('BUTTON');
        expect(btn.textContent).toBe(tr.popup_shortcut_setup);
        btn.dispatchEvent(new d.defaultView.Event('click'));
        expect(opened).toEqual([URLS[b]]);
      }
    });
  });

  test('语言切换后从空恢复为非空也能复位', () => {
    const d = doc();
    renderShortcutGuide(d, EMPTY, UA.chrome, translations.zh, () => {});
    renderShortcutGuide(d, SET, UA.chrome, translations.en, () => {});
    expect(d.getElementById('shortcutGuide').textContent).toBe('');
    expect(d.getElementById('shortcutPrefix').classList.contains('hidden')).toBe(false);
  });

  test('popup.js 接线：getAll → renderShortcutGuide，按钮用 tabs.create', () => {
    const src = read('src/ui/popup/popup.js');
    expect(src).toMatch(/chrome\.commands\.getAll\(\)/);
    expect(src).toMatch(/renderShortcutGuide\(document, shortcutCmds, navigator\.userAgent, t\(\)/);
    expect(src).toMatch(/chrome\.tabs\.create\(\{ url \}\)/);
  });
});

describe('taskList 地标', () => {
  test('taskList 为带名称的 region', () => {
    const d = parseHTML(read('src/ui/popup/popup.html')).document;
    const el = d.getElementById('taskList');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBeTruthy();
    expect(el.getAttribute('data-i18n-aria')).toBe('popup_task_list');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });
});
