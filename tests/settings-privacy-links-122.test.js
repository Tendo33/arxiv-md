// 1.2.2：数据说明面板删除后，设置页 PDF 解析分组下方仍列出 PaddleOCR、MinerU 的隐私政策链接（沿用 C13 / C14 的地址和文案）
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '../src/config/locales';
import { NW_ZH } from '../src/ui/settings/nw-segments';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
const { document } = parseHTML(html);

const LINKS = [
  ['privacyLinkPaddleocr', 'https://www.baidu.com/duty/yinsiquan.html', 'pdf_privacy_link_paddleocr', '百度隐私权保护声明（中文）', 'Baidu privacy policy (in Chinese)'],
  ['privacyLinkMineru', 'https://sso.openxlab.org.cn/protocol/privacy', 'pdf_privacy_link_mineru', 'MinerU 个人信息保护政策（OpenXLab，中文）', 'MinerU privacy policy (OpenXLab, in Chinese)'],
];

test.each(LINKS)('%s：地址、新标签页、文案 key', (id, href, key, zh, en) => {
  const a = document.getElementById(id);
  expect(a).toBeTruthy();
  expect(a.getAttribute('href')).toBe(href);
  expect(a.getAttribute('target')).toBe('_blank');
  expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  expect(a.querySelector(`[data-i18n="${key}"]`).textContent).toBe(en);
  expect(a.querySelector('.sr-only[data-i18n="link_new_tab"]')).toBeTruthy();
  expect(a.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  expect([translations.zh[key], translations.en[key]]).toEqual([zh, en]);
  expect(NW_ZH[key].join('')).toBe(zh);
});

test('链接在 PDF 解析分组里、后端卡片之后；标签文案中英文都有', () => {
  const box = document.getElementById('pdfPrivacyLinks');
  expect(box.closest('#pdfProviderSection')).toBeTruthy();
  expect(document.getElementById('pdfProviderGroup').contains(box)).toBe(false);
  expect(box.querySelector('[data-i18n="pdf_privacy_label"]')).toBeTruthy();
  expect(translations.zh.pdf_privacy_label).toBe('服务方隐私政策：');
  expect(translations.en.pdf_privacy_label).toBe('Provider privacy policies:');
  expect(css).toMatch(/\.privacy-links \{[^}]*flex-wrap: wrap/);
});
