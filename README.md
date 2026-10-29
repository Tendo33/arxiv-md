<div align="center">

<img src="assets/icon-128.png" width="96" alt="arXiv to Markdown icon">

# arXiv to Markdown

**Save arXiv papers as Markdown in one click, with PDFs named by title.**

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/pphdggfbjddgdljndgdablkhbdpbfnbd?style=flat-square&label=Chrome%20Web%20Store&color=b31b1b)](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd)
[![License: MIT](https://img.shields.io/badge/License-MIT-black?style=flat-square)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](./src/manifest.json)

[Install](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd) · [中文说明](./README_CN.md) · [FAQ](./docs/FAQ.md) · [Privacy](./PRIVACY.md) · [Changelog](./CHANGELOG.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/hero-dark.png">
  <img src="docs/screenshots/hero-light.png" width="860" alt="Export buttons on an arXiv abstract page, with the extension popup">
</picture>

</div>

> Screenshots show the Chinese UI. The extension follows your browser language (Chinese or English) and can be switched in Settings.

## Features

- **One-click Markdown export**: adds `Markdown`, `PDF` and `BibTeX` buttons under `Submission history` on arXiv abstract pages.
- **Official HTML first**: converts arXiv's official HTML version, falls back to ar5iv, and downloads the PDF when neither is available.
- **Keeps math and structure**: LaTeX stays as `$...$` / `$$...$$`; simple tables become GFM, tables with merged cells stay as HTML; in-text citations link to the numbered references and footnotes become `[^n]`.
- **Optional YAML frontmatter**: `title`, `arxiv_id`, `source`, `authors`, `year` for Obsidian, Logseq, Zotero and similar tools.
- **PDFs named by title**: `Attention Is All You Need (2017).pdf` instead of `1706.03762.pdf`.
- **Copy BibTeX**: uses arXiv's official citation, or builds one from the page title, authors and year.
- **Copy for AI or notes**: after a conversion, a result card on the page offers "Copy Markdown". Cards with action buttons stay until you close them; other finished cards hide after 10 seconds (paused while hovered or focused).
- **Optional PDF parsing**: with your own API key, the PDF is parsed in the background by the provider you pick in Settings — PaddleOCR (default, free quota) or MinerU; PaddleOCR results are saved as a ZIP laid out like MinerU's (`full.md` + `images/`), MinerU results as its original ZIP; progress shows in the popup.
- **Several entry points**: page buttons, toolbar popup, context menu, keyboard shortcut, and a floating button on PDF pages.
- **Chinese and English UI**, light and dark themes.

| In-page buttons | Exported Markdown |
| --- | --- |
| <img src="docs/screenshots/page-buttons.png" alt="In-page buttons and result card"> | <img src="docs/screenshots/markdown-output.png" alt="Exported Markdown file"> |

## Install

**Chrome**: install from the [Chrome Web Store](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd). Requires Chrome 121 or later.

**Edge / Firefox**: planned, not yet listed.

**From source**:

```bash
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md
npm install
npm run build
```

Open `chrome://extensions`, enable Developer mode, click "Load unpacked" and pick `dist/`.

## Usage

1. Open any arXiv paper, e.g. <https://arxiv.org/abs/1706.03762>.
2. Click `Markdown` on the page to convert with your default mode and download a `.md` file.
3. Or click the toolbar icon and choose Export Markdown, PDF parsing, or Download PDF.

| Entry point | What it does |
| --- | --- |
| Page buttons | Under `Submission history`: `Markdown`, `PDF`, `BibTeX` |
| Toolbar popup | Detects the current paper; export buttons, the current PDF parsing provider and the PDF parsing task list |
| Shortcut | `Alt+Shift+M` (`Option+Shift+M` on macOS) converts the current paper on abs, PDF and HTML pages. If it shows "not set", use the popup's set-up link or `chrome://extensions/shortcuts` |
| Context menu | On a paper page: "Export this paper as Markdown", "Convert with PDF parsing (provider)" (shown only when the selected provider has a key); on an arXiv link: "Export linked arXiv paper as Markdown" |
| PDF floating button | Bottom-right on `arxiv.org/pdf/*`; can be turned off in Settings |

<img src="docs/screenshots/popup.png" width="300" alt="Toolbar popup">

## Settings

<img src="docs/screenshots/settings.png" width="720" alt="Settings page">

| Setting | Description |
| --- | --- |
| Conversion mode | `Standard` (recommended): official HTML → ar5iv → PDF; `PDF parsing mode`: always use PDF parsing with the selected provider, needs its key |
| PDF parsing | Pick the provider (PaddleOCR by default, or MinerU) and enter its API key; keys stay in `chrome.storage.local` on this device and never sync; the connection can be tested from Settings |
| Auto convert | Show a convert prompt when you open a paper |
| Markdown metadata | Write YAML frontmatter or not |
| Desktop notifications | Notify when a PDF parsing task finishes or fails |
| PDF floating button | Show the floating button on PDF pages |
| Language | 中文 / English |
| Usage statistics | Conversion counters kept in `chrome.storage.sync` (synced with your browser account if sync is on), never uploaded; can be reset |

Changes are saved automatically.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Settings (including the selected PDF parsing provider) and usage statistics are kept in `chrome.storage.sync`, so they sync with your browser account if browser sync is on; provider API keys and PDF parsing task state stay in `chrome.storage.local` on this device. A MinerU token saved by an older version is moved to local storage (copied, then deleted from sync); keys never sync, so on another device you are asked to re-enter the key |
| `downloads` | Saves Markdown, PDF or PDF parsing results |
| `activeTab` | Reads the arXiv page you are on so it can be converted |
| `notifications` | Desktop notice when a PDF parsing task finishes or fails |
| `alarms` | Wakes the background worker to poll running PDF parsing tasks |
| `contextMenus` | Adds the right-click menu items |
| `arxiv.org`, `export.arxiv.org` | Paper HTML, metadata and PDF |
| `ar5iv.org`, `ar5iv.labs.arxiv.org` | ar5iv fallback when official HTML is missing |
| `mineru.net`, `cdn-mineru.openxlab.org.cn` | Only when you use MinerU: submit tasks and download results |
| `paddleocr.aistudio-app.com` (optional) | Requested only when you select PaddleOCR; revocable in Settings |
| `*.bj.bcebos.com` (optional) | Requested together with PaddleOCR access; PaddleOCR serves parse results and figures from this Baidu storage domain |
| `declarativeNetRequestWithHostAccess` (optional) | Requested together with PaddleOCR access; only removes the `Origin` header on requests to that domain |
| Content script on `arxiv.org/abs/*`, `arxiv.org/pdf/*`, `arxiv.org/html/*` | Adds the page buttons, result card and PDF floating button on those pages |

## Privacy

- No backend, no analytics, and no data collection by the developer. Standard mode converts locally in your browser. Only PDF parsing sends anything to the third-party provider you choose: PaddleOCR uploads arXiv PDFs up to 50 MB as files and sends only the link for other PDFs; MinerU sends only the PDF link.
- In Standard mode, conversion runs entirely in your browser and only talks to arXiv and ar5iv.
- Only when you use PDF parsing is the paper sent, with your key, to the one provider you selected (PaddleOCR or MinerU, third-party services under their own terms): MinerU gets the arXiv PDF URL; PaddleOCR gets the arXiv PDF file itself (uploaded, up to 50 MB), and only the link for non-arXiv PDFs. A PDF over 50 MB is not sent; the extension suggests switching to MinerU. The extension never switches providers on its own. PaddleOCR is run by Baidu AI Studio. The applicable policy is the [Baidu privacy policy (in Chinese)](https://www.baidu.com/duty/yinsiquan.html). For reference only, the [PaddlePaddle AI Studio privacy policy (in Chinese)](https://aistudio.baidu.com/privacy) states that it applies to "WeChat Mini Program and mobile browsers (excluding PC)", so it does not cover this extension's API calls.
- See [PRIVACY.md](./PRIVACY.md).

## FAQ

**Why did I get a PDF instead of Markdown?**
Neither the official HTML nor ar5iv has a convertible version of that paper, so Standard mode falls back to the PDF. Try PDF parsing.

**Are images downloaded?**
No. Images in the Markdown are remote links to arXiv / ar5iv.

**The shortcut shows "not set".**
Another extension or the browser took it. Use the popup link or `chrome://extensions/shortcuts`.

**Why is the MinerU result a ZIP?**
MinerU returns a bundle with Markdown and images; the extension saves it as is.

More in [docs/FAQ.md](./docs/FAQ.md).

## Development

```bash
npm install
npm run dev       # watch build
npm run build     # unpacked extension in dist/
npm run lint
npm test
npm run package   # build/arxiv-md-v<version>.zip
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
