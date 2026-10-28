// pdf-parse-core 公共入口。core 不准反向依赖插件代码（.eslintrc overrides: no-restricted-imports）。
export const CORE_VERSION = '0.1.0';
export * from './provider';
export { createRegistry } from './registry';
export * from './errors';
