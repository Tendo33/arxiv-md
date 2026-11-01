import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { NW_ZH, nwNodes, splitZh, setNwText } from '../src/ui/settings/nw-segments';
import { translations } from '../src/config/locales';

describe('R09：中文按短语断行（.nw）', () => {
  test('每张切分表拼起来与 zh 文案一字不差', () => {
    for (const [k, segs] of Object.entries(NW_ZH)) expect([k, segs.join('')]).toEqual([k, translations.zh[k]]);
  });
  test('zh 生成 .nw span（DOM API，无 innerHTML）；en 原样文字', () => {
    const { document } = parseHTML('<p id="x"></p>');
    const el = document.getElementById('x');
    setNwText(el, 'advanced_auto', translations.zh.advanced_auto, 'zh');
    expect([...el.querySelectorAll('span.nw')].map((s) => s.textContent)).toEqual(['打开论文时', '询问是否导出']);
    expect(el.textContent).toBe(translations.zh.advanced_auto);
    setNwText(el, 'advanced_auto', translations.en.advanced_auto, 'en');
    expect(el.querySelector('span')).toBeNull();
    expect(el.textContent).toBe(translations.en.advanced_auto);
  });
  test('没有切分表的句子在标点后切开，拼回原文', () => {
    const t = translations.zh.err_reason_upload_limit;
    expect(splitZh(t).join('')).toBe(t);
    expect(splitZh(t).length).toBeGreaterThan(3);
    const { document } = parseHTML('<p></p>');
    expect(nwNodes(document, 'pdf_key_here', '短句', 'zh')).toEqual(['短句']);
  });
  test('CSS 有 .nw { white-space: nowrap; }，nw-segments 不用 innerHTML', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
    expect(css).toMatch(/\.nw \{ white-space: nowrap; \}/);
    expect(fs.readFileSync(path.join(__dirname, '../src/ui/settings/nw-segments.js'), 'utf8')).not.toMatch(/innerHTML/);
  });
});
