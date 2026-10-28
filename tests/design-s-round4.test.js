// R4 设计复核非阻塞建议 S1–S9
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
import { translations } from '../src/config/locales';
import { ctxBadgeState } from '../src/ui/popup/ctx-badge';

describe('S1 没有 Key：卡片徽标中性「需要 Key」而不是 Failed', () => {
  test.each([['zh', '需要 Key'], ['en', 'Key needed']])('%s', (l, text) => {
    expect(ctxBadgeState({ state: 'needkey', kind: 'abs' }, translations[l])).toEqual(['idle', text]);
    expect(ctxBadgeState({ state: 'err', kind: 'abs' }, translations[l])[0]).toBe('err');
  });
  test('runExport 的无 Key 分支把状态设为 needkey', () => {
    expect(read('src/ui/popup/popup.js')).toMatch(/if \(!active\.hasKey\) \{[\s\S]{0,400}ctx\.state = 'needkey';\s*(\/\/[^\n]*)?\s*renderContext\(\);\s*return;/);
  });
});
