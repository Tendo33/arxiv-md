import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales.js';
import { NW_ZH, setNwText } from '../src/ui/settings/nw-segments.js';

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const KEYS = ['popup_key_here_hint', 'popup_err_token_hint', 'pdf_disc_needed_body'];

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
  test('popup.js 用 setNwText 写 #keyHereHint，popup.css 给 .nw nowrap', () => {
    expect(read('src/ui/popup/popup.js')).toMatch(/setNwText\(\$\('keyHereHint'\)/);
    expect(read('src/ui/popup/popup.css')).toMatch(/#keyHereHint \.nw\{white-space:nowrap\}/);
  });
});
