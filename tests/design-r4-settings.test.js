const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');

describe('B5（取代 M4）：Key 行 = 输入框（尾部显示按钮）+ 测试连接 + 行内状态', () => {
  test('.key-field 可收缩（min-width:0），窄屏独占一行；显示按钮在输入框内', () => {
    expect(css).toMatch(/\.key-field \{ position: relative; flex: 1 1 240px; min-width: 0;/);
    expect(css).toMatch(/@media \(max-width: 479px\) \{ \.key-field \{ flex-basis: 100%; \} \}/);
    expect(html).toMatch(/<div class="key-field">[\s\S]*id="providerKey"[\s\S]*id="toggleTokenBtn"[\s\S]*<\/div>/);
  });
});

describe('设计验收 M5：授权/撤销按钮套 .btn 基类', () => {
  test('两个按钮 class="btn btn-secondary"，行内按钮 ≥36px 且不拉满', () => {
    expect(html).toMatch(/id="grantPermissionBtn" class="btn btn-secondary"/);
    expect(html).toMatch(/id="revokePermissionBtn" class="btn btn-secondary"/);
    expect(css).toMatch(/\.permission-row \.btn, \.revoke-row \.btn \{ min-height: 36px; padding: 0 12px; width: auto; flex: none; \}/);
  });
});

describe('R01：后端不再用原生下拉框', () => {
  test('select.input-field 规则已删除', () => {
    expect(css).not.toMatch(/select\.input-field/);
  });
});

describe('a11y：语言按钮的可访问名称包含可见文字', () => {
  test('不用覆盖可见文字的 aria-label，说明放在 sr-only 里', () => {
    const btn = html.match(/<button[^>]*id="langToggle"[^>]*>[\s\S]*?<\/button>/)[0];
    expect(btn).not.toMatch(/aria-label=/);
    expect(btn).toMatch(/<span id="langText">[^<]*<\/span><span class="sr-only" data-i18n="lang_switch">/);
    expect(css).toMatch(/\.sr-only\{position:absolute;width:1px;height:1px/);
  });
});
