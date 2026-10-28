import { createRegistry } from '../registry.js';
import { mineruProvider } from './mineru.js';

/** 默认注册表（顺序固定，即设置页下拉的顺序） */
export function createDefaultRegistry() {
  const r = createRegistry();
  r.register(mineruProvider);
  return r;
}

export { mineruProvider };
