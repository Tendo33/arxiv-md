import { translations } from '@config/locales';

describe('设计验收 M7：Key 区统一叫 Key', () => {
  test('token_* 与 MinerU 说明里不再出现 Token（中英）', () => {
    for (const l of ['zh', 'en']) {
      const tr = translations[l];
      const keys = Object.keys(tr).filter((k) => k.startsWith('token_')).concat('pdf_desc_mineru', 'mode_requires_token');
      expect(keys.length).toBeGreaterThan(6);
      for (const k of keys) expect(`${l}.${k} → ${tr[k]}`.split(' → ')[1]).not.toMatch(/token/i);
    }
  });
  test('评审给的中文用词', () => {
    const zh = translations.zh;
    expect(zh.token_valid).toBe('✅ Key 格式正确');
    expect(zh.token_empty_error).toBe('请先填写 Key');
    expect(zh.token_api_valid).toBe('✅ Key 可用');
    expect(zh.token_toggle).toBe('显示/隐藏 Key');
  });
});
