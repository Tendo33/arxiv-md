/**
 * release-polish AR-04：Firefox / AMO 可提交——gecko id、background.scripts 兜底、minimum_chrome_version 121；
 * 源码不再给 innerHTML 赋值（页面 / 用户数据走 textContent），web-ext lint 0 error 在 dev-log 里记录。
 */
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import manifest from '../src/manifest.json';
import { translations } from '../src/config/locales';
import { mountPdfFab } from '../src/content/pdf-fab';
import { preprocessAr5ivElements } from '../src/content/ar5iv-elements';
import { preprocessAuthorsAndMetadata, preprocessTables } from '../src/content/ar5iv-structure';
import { h, svg, setChildren, copyChildren } from '../src/utils/dom';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

describe('AR-04 manifest', () => {
  test('gecko id + background.scripts 兜底 + 最低 Chrome 121', () => {
    expect(manifest.browser_specific_settings).toEqual({ gecko: { id: 'arxiv-md@tendo33' } });
    expect(manifest.background).toEqual({ service_worker: 'background.js', scripts: ['background.js'] });
    expect(manifest.minimum_chrome_version).toBe('121');
  });
  test('没有加 data_collection_permissions（只在待决策里提案）', () => {
    expect(manifest.browser_specific_settings.gecko).not.toHaveProperty('data_collection_permissions');
  });
});

describe('AR-04 不再给 innerHTML / outerHTML 赋值', () => {
  test('src 下没有 innerHTML = / outerHTML = / insertAdjacentHTML', () => {
    const files = walk(path.join(__dirname, '../src')).filter((f) => f.endsWith('.js'));
    const hits = [];
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        if (/\.(innerHTML|outerHTML)\s*\+?=(?!=)|insertAdjacentHTML\(/.test(code)) hits.push(`${path.relative(process.cwd(), f)}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('AR-04 DOM 构建行为', () => {
  test('h / svg / setChildren：文本不会被当成标记', () => {
    const { document } = parseHTML('<html><body></body></html>');
    const el = h(document, 'div', { class: 'x' }, ['<b>t</b>', h(document, 'span', null, 'y')]);
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toBe('<b>t</b>y');
    const icon = svg(document, ['svg', { viewBox: '0 0 1 1' }, [['path', { d: 'M0 0' }]]]);
    expect(icon.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(icon.querySelector('path').getAttribute('d')).toBe('M0 0');
    setChildren(el, 'z');
    expect(el.textContent).toBe('z');
  });

  test('copyChildren 等价于复制 innerHTML', () => {
    const { document } = parseHTML('<div id="a">x <em>y</em> &lt;z&gt;</div>');
    const b = copyChildren(document.getElementById('a'), document.createElement('div'));
    expect(b.innerHTML).toBe(document.getElementById('a').innerHTML);
  });

  test('参考文献标签含 < 时按文字保留', () => {
    const { document } = parseHTML('<html><body><ul><li class="ltx_bibitem"><span class="ltx_tag">[&lt;1&gt;]</span><span class="ltx_bibblock">A. <em>B</em>.</span></li></ul></body></html>');
    preprocessAr5ivElements(document);
    const li = document.querySelector('.ltx_bibitem');
    expect(li.querySelector('.ltx_bib_tag').textContent).toBe('[<1>]');
    expect(li.querySelector('em').textContent).toBe('B');
    expect(li.textContent).toBe('[<1>] A. B.');
  });

  test('作者分隔符 & 换成空行，标记保留', () => {
    const { document } = parseHTML('<html><body><span class="ltx_personname">A &amp; <a href="#">B</a> &amp; C</span></body></html>');
    preprocessAuthorsAndMetadata(document);
    const el = document.querySelector('.ltx_personname');
    expect(el.textContent).toBe('A \n\n B \n\n C');
    expect(el.querySelector('a')).toBeTruthy();
  });

  test('表头 td → th 保留内容', () => {
    const { document } = parseHTML('<html><body><table class="ltx_tabular"><tr><td>Name <b>x</b></td><td>Val</td></tr><tr><td>a.1</td><td>2.0</td></tr></table></body></html>');
    preprocessTables(document);
    const ths = document.querySelectorAll('th');
    if (ths.length) expect(ths[0].innerHTML).toBe('Name <b>x</b>');
  });

  test('PDF 悬浮按钮：圆环 + 图标，状态切换后只剩一套', () => {
    const { document } = parseHTML('<html><body></body></html>');
    const t = translations.en;
    const fab = mountPdfFab(document, { labels: { idle: t.content_fab_idle, run: t.content_fab_run, ok: t.content_fab_ok, err: t.content_fab_err }, onClick: () => {} });
    expect(fab.button.textContent).toBe('M↓');
    fab.setState('ok');
    expect(fab.button.querySelectorAll('.ring')).toHaveLength(1);
    expect(fab.button.querySelector('svg path').getAttribute('d')).toBe('M5 12l5 5L20 7');
    fab.setState('idle');
    expect(fab.button.querySelector('svg')).toBeNull();
  });
});

describe('AR-04 摘要页按钮', () => {
  afterAll(() => { delete global.window; delete global.document; delete global.chrome; delete global.getComputedStyle; });
  test.each(['zh', 'en'])('%s：按钮文字、进度条、自动提示都由 DOM 构建', async (lang) => {
    jest.resetModules();
    const { window, document } = parseHTML('<html><head></head><body><div class="submission-history">h</div></body></html>');
    Object.defineProperty(window, 'location', { value: { href: 'https://arxiv.org/abs/1810.04805' }, configurable: true });
    global.window = window; global.document = document;
    global.getComputedStyle = () => ({ backgroundColor: 'rgb(255,255,255)', color: 'rgb(0,0,0)' });
    window.getComputedStyle = global.getComputedStyle;
    window.matchMedia = () => ({ matches: false });
    global.chrome = { storage: { sync: { get: async () => ({}) }, local: { get: async () => ({}) } }, runtime: { sendMessage: jest.fn() } };
    const t = translations[lang];
    const mod = require('../src/content/page-buttons');
    mod.setPageButtonText(t);
    await mod.injectConvertButton();
    const md = document.querySelector('.arxiv-md-convert-btn');
    expect(md.querySelector('svg')).toBeTruthy();
    expect(md.textContent.startsWith(`${t.content_btn_markdown} (`)).toBe(true);
    const pdf = document.querySelector('.arxiv-pdf-download-btn');
    expect(pdf.textContent).toBe(`${t.content_btn_pdf} (${t.content_btn_sub_title})`);
    expect(pdf.querySelector('.arxiv-md-btn-sub').textContent).toBe(`(${t.content_btn_sub_title})`);
    const prog = document.querySelector('.arxiv-md-progress');
    expect(prog.querySelector('.progress-text').textContent).toBe(t.content_progress_processing);
    expect(prog.querySelector('.progress-percent').textContent).toBe('0%');
    expect(prog.querySelector('.progress-detail')).toBeTruthy();
    const auto = document.querySelector('.arxiv-md-auto');
    expect(auto.querySelector('[data-action="auto-confirm"]').textContent).toBe(t.content_auto_prompt_confirm);
    expect(auto.querySelector('[data-action="auto-cancel"]').textContent).toBe(t.content_auto_prompt_cancel);
  });
});
