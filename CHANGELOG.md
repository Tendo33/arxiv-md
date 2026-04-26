# Changelog

This file records release notes and documentation-visible changes to the repository.

For current product behavior, prefer `README.md`, `README_CN.md`, and the files under `docs/`, because historical release notes may describe older workflows.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
