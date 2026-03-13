# Tag Release CI 设计方案

日期：2026-03-13

## 背景与目标

当仓库打 `vX.Y.Z` tag 时，自动运行打包并创建 GitHub Release，把打包的 zip 附件上传到 Release 中。

## 触发与范围

- 触发条件：`push` 到 `refs/tags/v*.*.*`
- 触发时机：仅在打 tag 时触发

## 构建与打包

- Node 版本：22
- 依赖安装：`npm ci`
- 打包命令：`npm run package`
- 产物路径：`build/arxiv-md-v<version>.zip`
- 版本来源：`package.json` 的 `version`

## Release 策略

- 创建 Release：`gh release create <tag> --generate-notes`
- Release 标题：与 tag 一致（如 `v1.1.5`）
- Release Notes：自动生成
- 附件：上传 `build/arxiv-md-v<version>.zip`

## 权限与失败策略

- 权限：`contents: write`，使用 `GITHUB_TOKEN`
- 失败策略：任意步骤失败则 workflow 失败，避免发布不完整产物

## 可观测性

打包脚本 `scripts/package.js` 已输出 zip 文件路径和大小，可在 CI 日志中查看。

