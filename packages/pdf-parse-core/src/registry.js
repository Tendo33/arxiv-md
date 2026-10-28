// R4-02：Provider 注册表。list() 按注册顺序返回（固定顺序）。
import { defineProvider } from './provider';

export function createRegistry() {
  const map = new Map();
  return {
    register(provider) {
      const p = defineProvider(provider);
      if (map.has(p.id)) throw new Error(`Provider "${p.id}" already registered`);
      map.set(p.id, p);
      return p;
    },
    get(id) { return map.get(id) || null; },
    has(id) { return map.has(id); },
    list() { return [...map.values()]; },
    ids() { return [...map.keys()]; },
  };
}
