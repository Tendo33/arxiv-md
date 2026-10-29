// R4-05：设置页撤销行说明“不撤销则切回时沿用授权、不再弹提示”（zh/en）
import { translations } from '@config/locales';
test.each([['zh', /不会再弹出授权提示/], ['en', /no permission prompt will appear/]])('%s 撤销文案包含沿用授权说明', (l, re) => {
  const s = translations[l].pdf_revoke_text;
  expect(s).toMatch(re);
  expect(s).toContain('{provider}');
  expect(s).toContain('{host}');
});
