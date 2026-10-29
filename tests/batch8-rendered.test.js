/**
 * batch8 ③：用真实 markdown-it（html:true）渲染全部 arXiv HTML 夹具的转换结果，断言除转换器有意输出的锚点/表格外没有 html_inline / html_block token
 * （即正文里的 <tag> 都被转义，不会被 Markdown 渲染器当成 raw HTML）。
 * markdown-it 不是本仓库依赖：只从本仓库 node_modules（CI 里临时 --no-save 安装）或 MD_RENDERER_DIR 加载；
 * 都加载不到时跳过；但设置了 MD_RENDERER_DIR 却加载不到时直接失败，避免"以为跑了其实跳过"。
 * 跑完打印一行：rendered check: markdown-it x.y.z, N samples, 0 html tokens
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { createRequire } from 'module';
import { parseHTML, Node } from 'linkedom';
import ar5ivConverter from '../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { listPaperFixtures, convertFixture } from './helpers/paper-fixtures';

const ROOT = path.join(__dirname, '..');

function loadMarkdownIt() {
  const dirs = [ROOT, process.env.MD_RENDERER_DIR].filter(Boolean);
  for (const d of dirs) {
    try {
      const req = createRequire(path.join(d, 'package.json'));
      const MarkdownIt = req('markdown-it');
      const version = JSON.parse(fs.readFileSync(req.resolve('markdown-it/package.json'), 'utf8')).version;
      return { MarkdownIt, version };
    } catch { /* next */ }
  }
  if (process.env.MD_RENDERER_DIR) {
    throw new Error(`rendered check: 设置了 MD_RENDERER_DIR=${process.env.MD_RENDERER_DIR}，但加载不到 markdown-it（查找过：${dirs.join(', ')}）`);
  }
  return null;
}

/** 公式是转换器自己输出的 LaTeX（$a<b$ 之类），渲染器侧本就不当 HTML；先换成占位符再查 token。代码块/行内代码交给 markdown-it 自己处理。 */
function maskMath(md) {
  let i = 0;
  return md
    .split(/(^```[\s\S]*?^```)/m)
    .map((part, k) => (k % 2 ? part : part
      .replace(/\$\$[\s\S]+?\$\$/g, () => `AMATH${i++}`)
      .replace(/(?<![\\$])\$(?!\s)(?:\\\$|[^$\n])+?\$/g, () => `AMATH${i++}`)))
    .join('');
}

// 转换器有意输出的 HTML：参考文献锚点 <a id="bib.bibN"></a>（ar5iv-references.js），
// 以及合并单元格表格的 <table> 块（ar5iv-elements.js）；表格块里只允许表格结构标签，单元格文字里的 <tag> 仍须转义。
const ANCHOR = /^(?:<a id="[A-Za-z0-9._-]+">|<\/a>)$/;
const TABLE_TAG = /^<\/?(?:table|thead|tbody|tfoot|tr|th|td|caption|br)\b[^>]*>$/i;
function allowed(t) {
  const c = t.content.trim();
  if (t.type === 'html_inline') return ANCHOR.test(c);
  if (!/^<table\b/i.test(c)) return false;
  return (c.match(/<[^>]*>/g) || []).every((tag) => TABLE_TAG.test(tag));
}

function htmlTokens(md, src) {
  const out = [];
  let ok = 0;
  const walk = (toks) => toks.forEach((t) => {
    if (t.type === 'html_inline' || t.type === 'html_block') {
      if (allowed(t)) ok += 1; else out.push(t.content.trim().slice(0, 80));
    }
    if (t.children) walk(t.children);
  });
  walk(md.parse(src, {}));
  return { out, ok };
}

const loaded = loadMarkdownIt();
const AB6_DIR = path.join(__dirname, 'fixtures', 'ab6');
// AB6-01 的整篇原文（代码/公式里有 <NAME>、<PROOFSTEP>、List<String> 等）也一起渲染
function convertAb6(file) {
  global.Node = Node;
  const id = file.replace(/-article\.html\.gz$/, '');
  const html = zlib.gunzipSync(fs.readFileSync(path.join(AB6_DIR, file))).toString('utf8');
  const cleaned = ar5ivConverter.cleanHtml(html);
  const { document } = parseHTML(`<!doctype html><html><body>${cleaned.content}</body></html>`);
  return convertAr5ivDocument(document, { assetPageUrl: `https://arxiv.org/html/${id}` });
}
const fixtures = [
  ...listPaperFixtures().map((f) => [`papers/${f}`, () => convertFixture(f)]),
  ...fs.readdirSync(AB6_DIR).filter((f) => f.endsWith('.html.gz')).sort().map((f) => [`ab6/${f}`, () => convertAb6(f)]),
];
const d = loaded ? describe : describe.skip;
let samples = 0;
let tokens = 0;
let allowedCount = 0;

d('batch8 ③ 渲染检查：夹具输出无 raw HTML token', () => {
  const md = loaded && new loaded.MarkdownIt({ html: true });
  afterAll(() => {
    process.stdout.write(`\nrendered check: markdown-it ${loaded.version}, ${samples} samples, ${tokens} html tokens (arxiv fixtures; allowed bib anchors/structural <table>: ${allowedCount})\n`);
  });
  test.each(fixtures)('%s', (name, convert) => {
    const markdown = convert();
    const { out, ok } = htmlTokens(md, maskMath(markdown));
    samples += 1;
    tokens += out.length;
    allowedCount += ok;
    expect(out).toEqual([]);
  });
});

if (!loaded) {
  test('rendered check: skipped（没有 markdown-it；设置 MD_RENDERER_DIR 或临时安装后再跑）', () => {});
}
