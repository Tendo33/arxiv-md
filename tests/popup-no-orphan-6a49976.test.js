// 设计复验 6a49976 M1 附带：en 提示标题（「PaddleOCR key is not set」「No PaddleOCR key on this device」）
// 和 P2-DNR 等待说明末行不留单个词 → text-wrap:pretty（浏览器实测见 dev-log）
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/popup/popup.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
test('.alert b uses text-wrap:pretty', () => { expect(css).toMatch(/\.alert b\{text-wrap:pretty\}/); });
test('.row .row-note uses text-wrap:pretty', () => { expect(css).toMatch(/\.row \.row-note\{[^}]*text-wrap:pretty[^}]*\}/); });
