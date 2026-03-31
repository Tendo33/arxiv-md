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
