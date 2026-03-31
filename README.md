# arXiv to Markdown

Save arXiv papers from the abstract page as clean Markdown, title-based PDFs, or MinerU result packages.

[Chrome Web Store](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd) · [中文说明](./README_CN.md) · [FAQ](./docs/FAQ.md) · [Architecture](./docs/ARCHITECTURE.md) · [Development](./docs/DEVELOPMENT.md) · [Privacy](./PRIVACY.md) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

## Overview

`arXiv to Markdown` is a Manifest V3 browser extension for Chrome and Edge.

On an arXiv abstract page, it injects two buttons below the submission history:

- `Markdown`: convert the paper through `ar5iv` or submit a MinerU task, depending on your default mode
- `PDF`: download the original paper with a title-based filename

The current codebase supports two real workflows:

1. `Standard Mode`
   ar5iv HTML -> local Markdown conversion in the page -> PDF fallback if ar5iv is unavailable or fails
2. `MinerU Mode`
   submit the paper PDF URL to MinerU -> poll in the background -> download a ZIP package when the task finishes

## What It Does Today

- Injects controls on `https://arxiv.org/abs/*`
- Extracts paper metadata from the abstract page, with arXiv export API as fallback
- Converts ar5iv HTML to Markdown in the browser with custom Turndown rules
- Preserves formulas as LaTeX where possible
- Keeps complex tables as raw HTML tables to avoid losing merged cells
- Leaves images as remote ar5iv asset links
- Adds optional YAML frontmatter to Markdown exports
- Tracks MinerU background tasks in the popup
- Supports English and Chinese in the popup, settings page, and content UI

## Install

### Option 1: Chrome Web Store

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd).

### Option 2: Local Development Build

```bash
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md
npm install
npm run build
```

Then open `chrome://extensions`, enable `Developer mode`, click `Load unpacked`, and choose `dist/`.

## How To Use It

1. Open an arXiv abstract page such as `https://arxiv.org/abs/1706.03762`.
2. Find the injected `Markdown` and `PDF` buttons below `Submission history`.
3. Click `Markdown` for the default conversion route configured in settings.
4. Click `PDF` if you only want the original paper with a readable filename.
5. Open the popup if you want to inspect, retry, delete, or download MinerU task results.

## Output Behavior

### Markdown output

- Source: ar5iv HTML
- Conversion runtime: browser content script
- Metadata: optional YAML frontmatter with `title`, `arxiv_id`, `source`, `authors`, and `year`
- Tables: preserved as HTML when necessary
- Images: stored as remote links, not bundled locally

### PDF output

- Triggered by the dedicated `PDF` button
- Downloads the original arXiv PDF directly from the page context
- Uses a title-based filename

### MinerU output

- Available only when `MinerU Mode` is enabled and a token is configured
- Runs as an async background task
- Downloads a ZIP package, not a Markdown file
- Appears in the popup task center

## Popup And Settings

### Popup

The popup is a MinerU task center, not a universal conversion history.

It shows:

- pending, processing, completed, and failed MinerU tasks
- progress for background parsing jobs
- actions to retry, delete, copy result links, or re-download ZIP files

### Settings

The settings page lets you:

- switch between `Standard Mode` and `MinerU Mode`
- save and test a MinerU API token
- enable or disable desktop notifications
- show the auto-convert prompt when a paper page loads
- include or exclude Markdown metadata
- switch UI language between English and Chinese
- reset usage statistics

## Repository Docs

- [README_CN.md](./README_CN.md): Chinese product overview
- [docs/FAQ.md](./docs/FAQ.md): usage questions and troubleshooting
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): current runtime and module design
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md): local setup, debugging, and release flow
- [docs/mentor/README.md](./docs/mentor/README.md): guided codebase reading pack for maintainers

## Development

```bash
npm run dev
npm run build
npm run lint
npm test
npm run package
```

The webpack build emits `dist/`, and `npm run package` creates `build/arxiv-md-v<version>.zip`.

## Current Limitations

- Buttons are injected on arXiv abstract pages, not on unrelated sites
- Standard mode does not auto-fallback to MinerU; it falls back to PDF
- Popup task management is only for MinerU jobs
- Images in Markdown stay remote
- MinerU is optional and depends on a third-party service

## License

MIT.
