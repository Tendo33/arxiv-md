import { createRegistry } from '../registry.js';
import { mineruProvider } from './mineru.js';
import { paddleocrProvider } from './paddleocr.js';

/** 默认注册表（顺序固定，即设置页下拉的顺序） */
export function createDefaultRegistry() {
  const r = createRegistry();
  r.register(paddleocrProvider); // 默认（免费额度）
  r.register(mineruProvider);
  return r;
}

export { mineruProvider, paddleocrProvider };
