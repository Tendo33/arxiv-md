import { parseHTML, Node } from 'linkedom';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { cleanLatexFormula, postProcessMarkdown } from '../src/content/ar5iv-preprocess';

describe('ar5iv markdown', () => {
  beforeAll(() => {
    global.Node = Node;
  });

  test('keeps inline and display math, absolutizes images, and preserves tables', () => {
    const html = `<!doctype html><html><body>
      <article>
        <h2 class="ltx_title_section"><span class="ltx_tag">1</span>Intro</h2>
        <p class="ltx_p">Energy <math alttext="E=mc^2"><mi>E</mi></math> stays inline.</p>
        <math display="block" alttext="\\displaystyle a+b"><mi>a</mi></math>
        <table class="ltx_tabular">
          <tr><th>A</th><th>B</th></tr>
          <tr><td colspan="2">1</td></tr>
        </table>
        <img src="/assets/fig.png" alt="fig">
      </article>
    </body></html>`;
    const { document } = parseHTML(html);
    const markdown = convertAr5ivDocument(document);

    expect(markdown).toContain('$E=mc^2$');
    expect(markdown).toMatch(/\$\$\s*a\+b\s*\$\$/);
    expect(markdown).toContain('<table');
    expect(markdown).toContain('colspan="2"');
    expect(markdown).toContain('https://ar5iv.labs.arxiv.org/assets/fig.png');
    expect(markdown).toMatch(/#+\s+1 Intro/);
  });

  test('resolves official arXiv HTML images against the paper page', () => {
    const html = `<!doctype html><html><body>
      <img src="1706.03762v7/Figures/ModalNet-21.png" alt="model">
    </body></html>`;
    const { document } = parseHTML(html);
    const markdown = convertAr5ivDocument(document, {
      assetPageUrl: 'https://arxiv.org/html/1706.03762',
    });

    expect(markdown).toContain(
      'https://arxiv.org/html/1706.03762v7/Figures/ModalNet-21.png',
    );
  });

  test('keeps a document title with a line break on one heading line', () => {
    const html = `<!doctype html><html><body>
      <h1 class="ltx_title ltx_title_document">Predicting Alignment Generalization
        <br class="ltx_break">With Value Representations</h1>
    </body></html>`;
    const { document } = parseHTML(html);
    const markdown = convertAr5ivDocument(document);

    expect(markdown).toContain('# Predicting Alignment Generalization With Value Representations');
    expect(markdown).not.toMatch(/Generalization\s*\nWith Value/);
  });

  test('keeps a title break without surrounding whitespace on one line', () => {
    const html = `<!doctype html><html><body>
      <h1 class="ltx_title ltx_title_document">Alignment<br class="ltx_break">Generalization</h1>
    </body></html>`;
    const { document } = parseHTML(html);
    const markdown = convertAr5ivDocument(document);

    expect(markdown).toContain('# Alignment Generalization');
  });

  test('strips color commands from latex and leftover html from markdown', () => {
    expect(cleanLatexFormula('\\color{red}x+\\textcolor{blue}{y}')).toBe('x+y');
    const cleaned = postProcessMarkdown('See <span>kept</span> and \\[12\\].');
    expect(cleaned).toContain('kept');
    expect(cleaned).toContain('[12]');
    expect(cleaned).not.toContain('span');
  });
});
