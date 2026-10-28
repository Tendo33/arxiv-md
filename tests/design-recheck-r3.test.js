// 设计复验 Round 3：N1（320 宽英文任务行溢出）与 S1（英文句首大写）
import fs from 'fs';
import path from 'path';
import { translations } from '../src/config/locales';

const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
const list = fs.readFileSync(path.join(__dirname, '../src/ui/popup/task-list.js'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');

test('N1：标题列 min-width:0 + flex:1 1 auto + 省略号，去掉 min-width:6em', () => {
  expect(css).not.toMatch(/\.row \.n\{[^}]*min-width:6em/);
  const rule = css.match(/\.row \.n\{([^}]*)\}/)[1];
  expect(rule).toMatch(/flex:1 1 auto/);
  expect(rule).toMatch(/min-width:0/);
  expect(rule).toMatch(/text-overflow:ellipsis/);
  expect(rule).toMatch(/white-space:nowrap/);
});

test('N1：Download 按钮带 aria-label/title，≤339px 只显示图标', () => {
  expect(list).toMatch(/class="btn btn-ghost btn-dl" data-action="download"[^>]*title="\$\{t\.popup_action_download\}" aria-label="\$\{t\.popup_action_download\}"><svg aria-hidden="true"[\s\S]*?<span class="lbl">/);
  expect(css).toMatch(/@media \(max-width:339px\)\{[^\n]*\.btn-dl \.lbl\{display:none\}/);
});

test('S1：英文设置页 MinerU 标题句首大写', () => {
  expect(translations.en.mode_mineru_title).toBe('MinerU mode');
  expect(translations.en.mineru_title).toBe('MinerU API configuration');
  expect(settings).not.toMatch(/MinerU Mode|MinerU API Configuration/);
});
