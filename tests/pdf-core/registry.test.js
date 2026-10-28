// R4-02：Provider 接口 + 注册表
import { createRegistry } from '@pdf-core/registry';
import { defineProvider } from '@pdf-core/provider';

const base = (over = {}) => ({
  id: 'demo', label: 'Demo', hosts: [], credentialFields: [], mode: 'sync', input: 'url', cost: 'free',
  submit: async () => ({}), mapError: (e) => e, ...over,
});

describe('defineProvider', () => {
  test('合法 provider 通过并被冻结', () => {
    const p = defineProvider(base());
    expect(Object.isFrozen(p)).toBe(true);
  });
  test.each([
    ['id', { id: '' }], ['id 大写', { id: 'Bad' }], ['label', { label: '' }], ['hosts', { hosts: 'x' }],
    ['credentialFields', { credentialFields: null }], ['mode', { mode: 'stream' }], ['input', { input: 'file' }],
    ['cost', { cost: 'cheap' }], ['submit', { submit: null }], ['mapError', { mapError: null }],
    ['async 缺 poll', { mode: 'async' }],
  ])('缺/错字段：%s', (_n, over) => {
    expect(() => defineProvider(base(over))).toThrow(TypeError);
  });
  test('非对象', () => expect(() => defineProvider(null)).toThrow(TypeError));
});

describe('registry', () => {
  test('register / get / has / list / ids', () => {
    const r = createRegistry();
    r.register(base({ id: 'b' }));
    r.register(base({ id: 'a', mode: 'async', poll: async () => ({ state: 'done' }) }));
    expect(r.get('a').id).toBe('a');
    expect(r.get('zzz')).toBeNull();
    expect(r.has('b')).toBe(true);
    expect(r.list().map((p) => p.id)).toEqual(['b', 'a']);
    expect(r.ids()).toEqual(['b', 'a']);
  });
  test('重复 id 抛错', () => {
    const r = createRegistry();
    r.register(base());
    expect(() => r.register(base())).toThrow(/already registered/);
  });
  test('list() 顺序固定且返回副本', () => {
    const r = createRegistry();
    ['c', 'a', 'b'].forEach((id) => r.register(base({ id })));
    const l = r.list(); l.reverse();
    expect(r.list().map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
});
