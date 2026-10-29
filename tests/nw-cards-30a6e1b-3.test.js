// 设计验收 30a6e1b #3：卡片描述 .nw 手工分段，不拆「百度」「免费」「页数」
const { translations } = require('../src/config/locales');
const { NW_ZH } = require('../src/ui/settings/nw-segments');
test.each(['pdf_card_paddleocr', 'pdf_card_mineru'])('%s table joins to zh copy, words intact', (k) => {
  expect(NW_ZH[k].join('')).toBe(translations.zh[k]);
  for (const s of NW_ZH[k]) expect(s.trim().length).toBeLessThanOrEqual(12);
  const joined = NW_ZH[k].filter((s) => s.trim());
  for (const w of k === 'pdf_card_paddleocr' ? ['百度飞桨星河社区', '免费额度'] : ['页数上限', '免费账号']) expect(joined.some((s) => s.includes(w))).toBe(true);
});
