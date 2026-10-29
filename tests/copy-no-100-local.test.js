// 主管 17:17 / PM：「100% 本地处理」已无引用，删除；任何文案都不再声称 100% 本地
const fs = require('fs'); const path = require('path');
test('locales 不含 popup_feature_local 与「100% 本地」说法', () => {
  const s = fs.readFileSync(path.join(__dirname, '../src/config/locales.js'), 'utf8');
  expect(s).not.toMatch(/popup_feature_local|100% local|100% 本地/);
});
