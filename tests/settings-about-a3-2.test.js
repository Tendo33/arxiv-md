import fs from 'fs';
import path from 'path';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.js'), 'utf8');

describe('A3-2 设置页「关于」', () => {
  test('总转换次数在「关于」区内，没有删掉', () => {
    const about = html.slice(html.indexOf('id="aboutSection"'), html.indexOf('<!-- Actions -->'));
    expect(about).toContain('id="totalConversions"');
    expect(about).toContain('id="aboutVersion"');
    expect(about).toContain('id="resetStatsBtn"');
  });
  test('不再写死 v1.0.0，版本从 manifest 读', () => {
    expect(html).not.toContain('v1.0.0');
    expect(js).toMatch(/aboutVersion'\)\.textContent = `v\$\{manifest\.version\}`/);
  });
  test('文案：中英齐全；英文统计区句首大写一致（设计复验建议 2）', () => {
    expect(translations.zh.about_title).toBe('关于');
    expect(translations.en.about_title).toBe('About');
    for (const k of ['stats_title', 'stats_total', 'stats_ar5iv', 'stats_mineru', 'stats_pdf', 'stats_reset']) {
      const words = translations.en[k].split(' ').slice(1).filter((w) => !/^(MinerU|PDF|HTML|ar5iv)$/.test(w));
      for (const w of words) expect(w[0]).toBe(w[0].toLowerCase());
    }
    expect(html).not.toMatch(/MinerU Success|Total Conversions|PDF Fallback/);
  });
});
