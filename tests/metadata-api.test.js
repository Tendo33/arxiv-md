import { yearFromArxivId, arxivApiUrl } from '../src/core/metadata-extractor';

describe('PDF 页元数据', () => {
  test('新式 arXiv ID 推出年份作为兜底', () => {
    expect(yearFromArxivId('1706.03762')).toBe(2017);
    expect(yearFromArxivId('2305.18290v3')).toBe(2023);
    expect(yearFromArxivId('hep-th/9901001')).toBeNull();
  });
  test('API 地址指向 export.arxiv.org（manifest 已有该 host 权限）', () => {
    expect(arxivApiUrl('1706.03762')).toBe('https://export.arxiv.org/api/query?id_list=1706.03762');
  });
});
