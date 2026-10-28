// 快捷键未注册（commands.getAll 返回空 shortcut）时，在弹窗底栏给出「去设置」引导。
// 不需要新权限：chrome.tabs.create 打开 chrome:// / edge:// 页面不需要 tabs 权限。

export const SHORTCUT_COMMAND = 'convert-current-paper';

/** 按 UA 判断浏览器：'edge' | 'firefox' | 'chrome' */
export function detectBrowser(ua = '') {
  if (/\bFirefox\//.test(ua)) return 'firefox';
  if (/\bEdg\//.test(ua)) return 'edge';
  return 'chrome';
}

export function shortcutsPageUrl(browser) {
  if (browser === 'edge') return 'edge://extensions/shortcuts';
  if (browser === 'firefox') return null; // Firefox 没有可由扩展打开的快捷键页，只给文字提示
  return 'chrome://extensions/shortcuts';
}

export function shortcutGuide(cmds, ua = '', name = SHORTCUT_COMMAND) {
  const c = (cmds || []).find((x) => x && x.name === name);
  if (c && c.shortcut) return { set: true, shortcut: c.shortcut };
  return { set: false, url: shortcutsPageUrl(detectBrowser(ua)) };
}

/**
 * 渲染底栏快捷键区域。tr 为当前语言的 translations；openTab(url) 打开标签页。
 */
export function renderShortcutGuide(doc, cmds, ua, tr, openTab) {
  const g = shortcutGuide(cmds, ua);
  const kbd = doc.getElementById('shortcutKbd');
  const prefix = doc.getElementById('shortcutPrefix');
  const box = doc.getElementById('shortcutGuide');
  if (g.set) {
    kbd.textContent = g.shortcut;
    kbd.classList.remove('hidden');
    prefix.classList.remove('hidden');
    box.classList.add('hidden');
    box.replaceChildren();
    return g;
  }
  kbd.classList.add('hidden');
  prefix.classList.add('hidden'); // 「快捷键未设置」已含前缀，省出 320px 宽度
  const label = doc.createElement('span');
  label.className = 'sc-label';
  label.textContent = tr.popup_shortcut_unset;
  const sep = doc.createElement('span');
  sep.className = 'sc-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '·';
  box.replaceChildren(label, sep);
  if (g.url) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.id = 'shortcutSetup';
    btn.className = 'sc-link';
    btn.textContent = tr.popup_shortcut_setup;
    btn.addEventListener('click', () => openTab(g.url));
    box.append(btn);
  } else {
    const hint = doc.createElement('span');
    hint.className = 'sc-hint';
    hint.textContent = tr.popup_shortcut_firefox_hint;
    box.append(hint);
  }
  box.classList.remove('hidden');
  return g;
}
