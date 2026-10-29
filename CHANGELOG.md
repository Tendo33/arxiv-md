# Changelog

This file records release notes and documentation-visible changes to the repository.

For current product behavior, prefer `README.md`, `README_CN.md`, and the files under `docs/`, because historical release notes may describe older workflows.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-10-29

### 新增

- 快捷键没注册上（被别的扩展占用或浏览器保留）时，弹窗底部提示「快捷键未设置 · 去设置」，一键打开浏览器的快捷键页面（Chrome / Brave / Opera 为 `chrome://extensions/shortcuts`，Edge 为 `edge://extensions/shortcuts`，Firefox 显示文字说明）。不需要新权限。
- 下载 PDF 时，如果服务器给出文件大小，进度条显示真实进度；不知道大小时不再显示假的 0%。

### 改进

- 新图标：保留原有造型，换成品牌色，小尺寸下更清晰；工具栏补上 32px 图标。
- 下载失败的原因分得更细：文件不存在、服务器拒绝、服务器出错分别提示。
- 弹窗任务列表：窄窗口下标题单独一行；失败原因最多两行，鼠标悬停看全文；PDF 解析提交后显示「已提交」，不再误显示「已保存」。
- 设置页：提示条不再被底部操作栏挡住；链接的焦点框和点击区域更明显；页脚版权年份自动更新。
- 中文进度文案统一为「正在…」「导出」，按钮名用「」标出；英文 PDF 按钮写作 “by title”，并为读屏软件提供完整说明。
- 语言跟随规则统一：没选语言时一律跟随浏览器。
- 快捷键说明（扩展快捷键页面里看到的那句）跟随中英文界面。
- PaddleOCR 输出质量向 MinerU 看齐：被误识别成表格的图改为从页图裁出图片并保留图注；表格单元格里的裸 LaTeX 补上 `$…$`（`\cite`、`\textbf` 这类文字命令不包）；公式编号写成 `\tag{n}`；被拆成两段的行内公式合并；`\mathrm{}` / `\text{}` 里被拆开的字母拼回去；去掉居中 `div` 和表格的展示属性；被当成页眉丢掉的致谢和编号节标题恢复，层级按编号深度，跨页重复的页眉不算标题。
- 其中三条规则在通用的整理流程里：表格单元格补 `$…$`、行内公式合并、拆开字母拼回。MinerU 结果开启整理（`normalizeMinerU`，默认关）时也会经过这三条；其余几条只作用于 PaddleOCR。

### 修复

- PaddleOCR 解析修好，交付结构和 MinerU 一致：arXiv PDF 先下载再上传（星河拒收 arXiv 链接，错误码 10004），结果改读 JSONL，图片一起下载，打包成 ZIP（`full.md` + `images/`）。上传超时放宽到 5 分钟。
- PaddleOCR 请求规则没就绪时最多等 5 秒并重装，仍不行就提示，不再卡住。
- 弹窗任务列表：认不出的错误显示通用文案，原文只放在悬停提示里；页面卡片新增中性的「已取消」样式（可关闭，10 秒后自动隐藏；带操作按钮的卡片保留到手动关闭，其他已完成卡片 10 秒后收起）；PDF 下载成功卡片不再重复标题。
- ar5iv 返回「No content available」空页面或转换结果为空时，自动改用 PDF，不再保存空的 Markdown。
- 旧式 arXiv 编号（如 `math/0211159`）的 `/html/` 页面也能用快捷键转换。
- 取消下载后，如果页面上已经显示了下载卡片，就不再额外弹系统通知；卡片按下载任务对应，不会串号。
- Chrome / Edge 包不再带 `background.scripts`，Chrome 扩展页不再提示「'background.scripts' requires manifest version of 2 or lower」；Firefox 包用 `npm run build:firefox` 单独构建到 `dist-firefox/`，保留后台脚本。

### 其他

- 可以提交到 Firefox 附加组件商店：加入 Firefox 扩展 ID，后台脚本兼容 Firefox；页面里不再用 `innerHTML` 写入内容。最低 Chrome 版本为 121。
- 安装包更小：去掉约 200KB 的 `icon.svg` 和零散的许可证文件，第三方许可证合并为 `THIRD_PARTY_NOTICES.txt`。

### 依赖

- 依赖：npm audit fix 升级了 webpack 5.112 等传递 dev 依赖；其中 ajv-formats 2→3、es-module-lexer 1→2、commander 8→15 是跨大版本的传递 dev 依赖（node 22 满足）；katex 升到 0.19.1（仅测试使用）。

## [1.1.12] - 2026-10-10

### Added

- Standard mode tries official arXiv HTML at `https://arxiv.org/html/{id}` before ar5iv. PDF remains the fallback when neither HTML source has a convertible paper.

### Changed

- Images resolve against the HTML page that was actually fetched. Official figure paths stay on `arxiv.org`; ar5iv root-relative assets stay on `ar5iv.labs.arxiv.org`.
- The standard-mode button label is `HTML`. The unavailable hint appears only when both HTML sources fail.
- Frontmatter `source` is `arxiv-html` or `ar5iv`. A title broken by a line break stays on one YAML line and one Markdown heading.

## [1.1.11] - 2026-09-28

### Fixed

- The action popup stays 360 by 500 pixels. Viewport units made Chrome collapse it into a strip, so the title, stats, and footer wrapped.

## [1.1.10] - 2026-09-28

### Changed

- `npm run build` writes the unpacked extension to `dist/`. `npm run package` writes `build/arxiv-md-v<version>.zip`.
- Guides now point at the split content-script modules and the shared documentation order.

## [1.1.9] - 2026-09-28

### Added

- Copy BibTeX from the abstract page. The extension prefers arXiv's `/bibtex` record and falls back to the title, authors, and year on the page.
- Abstract tabs now use the paper title, so tab search and bookmarks are readable.

### Fixed

- Block formulas are kept as `$$...$$`. `String.replace` was treating `$$` as a single dollar.
- A deleted MinerU task stays deleted after the service worker restarts.

### Changed

- Split the content script, popup, and MinerU background worker into smaller modules, and added fixture tests for conversion, filenames, ar5iv availability, and MinerU responses.

## [Unreleased]

### Documentation

- Rewrote the main README, Chinese README, FAQ, architecture guide, development guide, contributing guide, and privacy policy to match the current codebase.
- Added a new `docs/mentor/` maintainer documentation pack for codebase onboarding.
- Clarified the real runtime model:
  - standard mode is `ar5iv -> PDF fallback`
  - MinerU is a separate token-based background workflow
  - the popup is a MinerU task center, not a universal conversion history

## [1.1.7] - 2026-04-26

### Fixes

- Fixed YAML frontmatter corruption when paper titles contain `:`, `#`, or other YAML special characters — values are now safely quoted.
- Fixed PDF button filename format to match Markdown output: now uses `Title (Year).pdf` via `generateFilename()` instead of the raw page title.
- Replaced `setInterval` keep-alive with `chrome.alarms` (`alarms` permission added to manifest), which is the correct MV3 approach.
- Fixed PDF download error propagation: content script now correctly detects and surfaces failures returned by the background handler.
- Fixed incorrect progress indicator showing "Completed" on PDF download failure.

### Improvements

- Unified PDF download path through the background `DOWNLOAD_PDF` handler, removing an in-memory `fetch + createObjectURL` that loaded the entire PDF into the renderer process.
- Merged duplicate `handleStartMinerUTask` / `handleStartMinerUTaskForce` into a shared internal implementation.
- Added `SHOW_NOTIFICATIONS` and `LANGUAGE` to the `STORAGE_KEYS` constant object, eliminating hardcoded storage key strings in `storage.js` and `helpers.js`.
- Removed two dead private methods (`_downloadBlobViaContentScript`, `_downloadMarkdown`) from the main converter.
- Fixed year parenthesis spacing in generated filenames: `Title(Year)` → `Title (Year)`.
- Replaced deprecated `String.prototype.substr` with `substring`.
- Upgraded Babel target from Chrome 88 to Chrome 109, reducing generated polyfill code.
- Webpack config now explicitly controls `process.env.NODE_ENV` injection via `DefinePlugin` with `optimization.nodeEnv: false`, removing reliance on Webpack's implicit behavior.
- MinerU: explicitly set `language: 'en'` in API requests to improve OCR accuracy on English arXiv papers.
- MinerU: added handling for the `converting` task state (format-export phase) with debug logging; updated full state enum in comments.
- MinerU: updated free-tier quota text to reflect current limits (1000 pages/day, priority queue).

## [1.1.6] - 2026-03-14

### Improvements

- Refined popup and settings spacing, typography, focus states, and responsive behavior.
- Added `:focus-visible` treatments and reduced-motion support across the UI.
- Reduced offscreen rendering cost with `content-visibility` and debounced task reloads.

## [1.1.1] - 2026-01-04

### New Features

- Improved math element processing and abstract extraction logic in the converter.
- Added an automated packaging script for generating release ZIP files.

### Fixes

- Minor stability improvements.

## [1.1.0] - 2025-12-24

### New Features

- Added the MinerU task center popup for task status, progress, and follow-up actions.
- Added the background service worker and MinerU task management flow.
- Added persistent task tracking for asynchronous MinerU processing.
- Expanded internationalization across popup and settings.

### Changes

- Refined popup and settings structure and styling.
- Improved MinerU API integration and error handling.

## [1.0.3] - 2025-12-23

### Release

- Prepared the first production-ready packaging flow.

## [1.0.2] - 2025-12-10

### Fixes

- Fixed extension-context invalidation after reload.
- Fixed algorithm block conversion issues.
- Fixed table header rendering problems.
- Improved arXiv button injection stability.

## [1.0.1] - 2025-12-10

### New Features

- Added smarter ar5iv availability checks.
- Added English and Chinese UI switching.
- Simplified popup and settings information architecture.

## [1.0.0] - 2025-12-02

### Initial Release

- Added arXiv abstract-page actions for Markdown and PDF export.
- Added ar5iv-based Markdown conversion.
- Added PDF fallback behavior.
- Added settings, statistics, and browser-extension packaging.

[1.1.6]: https://github.com/Tendo33/arxiv-md/releases/tag/v1.1.6
[1.1.1]: https://github.com/Tendo33/arxiv-md/releases/tag/v1.1.1
[1.1.0]: https://github.com/Tendo33/arxiv-md/releases/tag/v1.1.0
[1.0.3]: https://github.com/Tendo33/arxiv-md/releases/tag/v1.0.3
[1.0.2]: https://github.com/Tendo33/arxiv-md/releases/tag/v1.0.2
[1.0.1]: https://github.com/Tendo33/arxiv-md/releases/tag/v1.0.1
[1.0.0]: https://github.com/Tendo33/arxiv-md/releases/tag/v1.0.0
