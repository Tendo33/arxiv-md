# pdf-parse-core

arxiv-md 内的 npm workspace 包（Round 4 方案 B）。插件通过 `@pdf-core/*` 别名引用 `src/`。
规则：core 不能 import 插件代码（`@core`、`@utils`、`@config`、`@ui`、`@background`、`@/`、`src/`），由 eslint `no-restricted-imports` 保证。
