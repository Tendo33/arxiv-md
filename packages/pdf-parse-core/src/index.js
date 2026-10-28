// pdf-parse-core 公共入口。core 不准反向依赖插件代码（.eslintrc overrides: no-restricted-imports）。
export const CORE_VERSION = '0.1.0';
export * from './provider.js';
export { createRegistry } from './registry.js';
export * from './errors.js';
export * from './normalize/index.js';
export { createZip, crc32 } from './output/zip.js';
export { toDownloadUrl, buildDeliverable, saveDeliverable, canUseBlobUrl } from './output/save.js';
