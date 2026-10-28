const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');

describe('设计验收 M4：Key 输入组不换行', () => {
  test('最后生效的 .input-group 是 nowrap，输入框 min-width:0', () => {
    const tail = css.slice(css.lastIndexOf('.input-group'));
    expect(css.lastIndexOf('.input-group { flex-wrap: nowrap; }')).toBeGreaterThan(css.lastIndexOf('flex-wrap: wrap;\n  }'));
    expect(tail).toMatch(/\.input-group \.btn-icon \{ flex: none; \}/);
    expect(css).toMatch(/\.input-group input \{ min-width: 0; flex: 1; \}/);
  });
});
