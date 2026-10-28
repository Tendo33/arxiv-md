import fs from 'fs';
import path from 'path';
import { parseHTML, Node } from 'linkedom';
import katex from 'katex';
import ar5ivConverter from '../../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../../src/content/markdown-convert';

export const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'papers');

export function listPaperFixtures() {
  return fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.html')).sort();
}

/** 与扩展相同的两步：后台 cleanHtml，内容脚本 convertAr5ivDocument */
export function convertFixture(file) {
  global.Node = Node;
  const html = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
  const arxivId = file.replace(/\.html$/, '');
  const cleaned = ar5ivConverter.cleanHtml(html);
  const { document } = parseHTML(`<!doctype html><html><body>${cleaned.content}</body></html>`);
  return convertAr5ivDocument(document, { assetPageUrl: `https://arxiv.org/html/${arxivId}` });
}

/** 去掉代码块后提取 $$...$$ 与 $...$ 公式 */
export function extractFormulas(markdown) {
  const text = markdown.replace(/```[\s\S]*?```/g, '');
  const display = [...text.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((m) => m[1].trim());
  const rest = text.replace(/\$\$[\s\S]+?\$\$/g, ' ');
  const inline = [...rest.matchAll(/(?<![\\$])\$(?!\s)((?:\\\$|[^$\n])+?)\$/g)].map((m) => m[1]);
  return { display, inline };
}

export function katexErrors(formulas, displayMode) {
  const errors = [];
  for (const f of formulas) {
    try {
      katex.renderToString(f, { displayMode, throwOnError: true, strict: 'ignore' });
    } catch (e) {
      errors.push({ formula: f, message: e.message.split('\n')[0] });
    }
  }
  return errors;
}

export function countSourceMath(file) {
  const html = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
  const { document } = parseHTML(html);
  const article = document.querySelector('article.ltx_document') || document;
  return article.querySelectorAll('math').length;
}
