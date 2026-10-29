/** 设计 C14：PaddleOCR 隐私链接（C14 最终版）https://www.baidu.com/duty/yinsiquan.html，各入口文字一致；320 下 ↗ 不单独换行 */
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
const { document } = parseHTML('<!doctype html><html><body></body></html>');
import { buildDisclosurePanel, PRIVACY_LINKS, glueIcon } from '../src/ui/settings/disclosure';
import { translations } from '../src/config/locales';
import { nwNodes, NW_ZH } from '../src/ui/settings/nw-segments';
const URL_ = 'https://www.baidu.com/duty/yinsiquan.html';
const rd = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const ZH = '百度隐私权保护声明（中文）';
const EN = 'Baidu privacy policy (in Chinese)';

test('disclosure.js / locales', () => {
  expect(PRIVACY_LINKS.paddleocr).toBe(URL_);
  expect(translations.zh.pdf_disc_link_paddleocr).toBe(ZH);
  expect(translations.en.pdf_disc_link_paddleocr).toBe(EN);
  expect(NW_ZH.pdf_disc_link_paddleocr).toEqual(['百度隐私权保护声明', '（中文）']);
});

test.each([['zh', ZH], ['en', EN]])('%s 披露面板：链接文字完整，↗ 和最后一段在同一个 .nw 里', (lang, text) => {
  const seg = (k, t) => nwNodes(document, k, t, lang);
  const { panel } = buildDisclosurePanel(document, translations[lang], { id: 'paddleocr', label: 'PaddleOCR' }, seg);
  const a = panel.querySelector('a.pd-link');
  expect(a.getAttribute('href')).toBe(URL_);
  expect(a.querySelector('.pd-link-text').textContent).toBe(text);
  const svg = a.querySelector('svg');
  expect(svg.parentElement.classList.contains('nw')).toBe(true);
  expect(svg.parentElement.textContent).toBe(lang === 'zh' ? '（中文）' : 'Chinese)');
  if (lang === 'zh') expect([...a.querySelectorAll('.pd-link-text .nw')].map((n) => n.textContent)).toEqual(['百度隐私权保护声明', '（中文）']);
});

test('glueIcon：没有空格的单段文字整体和图标绑在一起', () => {
  const icon = document.createElement('i');
  const nodes = glueIcon(document, ['abc'], icon);
  expect(nodes).toHaveLength(1);
  expect(nodes[0].className).toBe('nw');
  expect(nodes[0].textContent).toBe('abc');
});

test('PRIVACY / README / README_CN 写的是同一个链接和文字', () => {
  expect(rd('PRIVACY.md')).toContain(`[${EN}](${URL_})`);
  expect(rd('README.md')).toContain(`[${EN}](${URL_})`);
  expect(rd('README_CN.md')).toContain(`[${ZH}](${URL_})`);
  for (const f of ['PRIVACY.md', 'README.md', 'README_CN.md', 'src/ui/settings/disclosure.js']) expect(rd(f)).not.toMatch(/飞桨星河社区隐私政策/);
});
