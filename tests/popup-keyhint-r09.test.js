import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales.js';
import { NW_ZH, setNwText } from '../src/ui/settings/nw-segments.js';
import { renderKeyHint } from '../src/ui/popup/key-hint.js';

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const KEYS = ['popup_key_here_hint', 'popup_err_token_hint'];

describe('R09：弹窗 #keyHereHint 中文按短语不拆词', () => {
  test.each(KEYS)('%s 手工分段逐字等于 zh 文案', (k) => {
    expect(NW_ZH[k].join('')).toBe(translations.zh[k]);
  });
  test('分段后「解析」「设备的」都在同一个 .nw 里', () => {
    const { document } = parseHTML('<p id="h"></p>');
    const el = document.getElementById('h');
    for (const k of KEYS) {
      setNwText(el, k, translations.zh[k], 'zh');
      const segs = [...el.querySelectorAll('.nw')].map((s) => s.textContent);
      expect(segs.join('')).toBe(translations.zh[k]);
      if (translations.zh[k].includes('PDF 解析')) expect(segs.some((s) => s.includes('PDF 解析'))).toBe(true);
      if (translations.zh[k].includes('设备的')) expect(segs.some((s) => s.includes('本设备的'))).toBe(true);
    }
  });
  test('两条写入路径（打开时 renderKeyHint、点击时 showNeedKey）都分段，popup.css 给 .nw nowrap', () => {
    const { document } = parseHTML('<div id="alertKey" class="hidden"><b id="keyHereTitle"></b><span id="keyHereHint"></span></div>');
    renderKeyHint(document, { id: 'paddleocr', keyMissingHere: true }, translations.zh, 'PaddleOCR', 'zh');
    const segs = [...document.querySelectorAll('#keyHereHint .nw')].map((s) => s.textContent);
    expect(segs).toEqual(NW_ZH.popup_key_here_hint);
    renderKeyHint(document, { id: 'paddleocr', keyMissingHere: true }, translations.en, 'PaddleOCR', 'en');
    expect(document.querySelector('#keyHereHint .nw')).toBeNull();
    expect(read('src/ui/popup/popup.js')).toMatch(/setHintText\(\$\('keyHereHint'\), hint, currentLang\)/);
    expect(read('src/ui/popup/popup.js')).toMatch(/renderKeyHint\(document, active, t\(\), providerLabel\(active\.id\), currentLang\)/);
    expect(read('src/ui/popup/popup.css')).toMatch(/#keyHereHint \.nw\{white-space:nowrap\}/);
  });
});
