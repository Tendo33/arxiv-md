import fs from 'fs';
import path from 'path';

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const rule = (css, sel) => {
  const m = css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return m ? m[2] : '';
};

describe('Round 2 设计验收', () => {
  const settings = read('src/ui/settings/settings.css');
  test('必须改 1：token 输入框用 --surface 底色', () => {
    expect(rule(settings, '.input-field')).toMatch(/background:\s*var\(--surface\)/);
  });
});
