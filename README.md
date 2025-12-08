<p align="center">
  <img src="./docs/icons/arxiv_md.png" alt="arXiv to Markdown" width="120">
</p>

<h1 align="center">arXiv to Markdown</h1>

<p align="center">
  <strong>One-click conversion of arXiv papers to Markdown with perfect LaTeX formula preservation</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension"></a>
  <a href="#"><img src="https://img.shields.io/badge/Manifest-V3-00C853" alt="Manifest V3"></a>
  <a href="#"><img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-use-cases">Use Cases</a> •
  <a href="#-faq">FAQ</a> •
  <a href="./README_CN.md">中文文档</a>
</p>

---

## 🎯 Why This Extension?

As a researcher, have you encountered these problems?

| Pain Point | Traditional Way | With This Extension |
|------------|-----------------|---------------------|
| 📄 Messy filenames | `2312.12345.pdf` | `Attention Is All You Need(2017).md` |
| 📝 Can't edit in note apps | PDF is read-only, copy formulas become garbled | Markdown directly editable, formulas render perfectly |
| 🔍 Hard to search knowledge base | PDF full-text search is slow | Markdown instant search |
| ⏱️ Time-consuming paper organization | Manual renaming, format conversion | One-click, <1 second |

**arXiv to Markdown** lets you focus on research, not file management.

---

## ✨ Features

### Core Features

- **⚡ Lightning Fast** — 85% of papers convert in under 1 second
- **🧮 Perfect Formulas** — LaTeX math formulas fully preserved, supports inline/block formulas
- **📊 Table Support** — Auto-converts to Markdown table format
- **🖼️ Image Preservation** — Image links point to ar5iv CDN, no local storage needed
- **📝 Smart Naming** — Auto-names files as `Title(Year).md`

### Smart Features

- **🧠 Auto Detection** — Intelligently detects ar5iv availability, hides Markdown button for new papers
- **🔄 Auto Fallback** — Automatically downloads renamed PDF when ar5iv unavailable
- **🌍 Multi-language UI** — Supports Chinese/English one-click switch
- **🔔 Desktop Notifications** — System notification when conversion completes (can be disabled)

### Privacy First

- **🔒 100% Local Processing** — No data uploaded to external servers
- **🚫 Zero Tracking** — No user behavior or browsing history collected
- **📦 Open Source** — MIT license, code fully public

---

## 🚀 Quick Start

### Three Steps to Get Started

```
1️⃣ Install Extension → 2️⃣ Visit arXiv Paper → 3️⃣ Click Button to Download
```

<details>
<summary><strong>📸 View Demo</strong></summary>

1. Visit any arXiv paper page (e.g., https://arxiv.org/abs/1706.03762)
2. Find two buttons below **Submission history**:
   - 🟣 **Save as Markdown** — Convert to Markdown
   - 🟠 **Save PDF (Renamed)** — Download renamed PDF
3. Click the button, file downloads automatically

</details>

### Output Example

The converted Markdown file contains:

```markdown
---
title: Attention Is All You Need
arxiv_id: 1706.03762
source: ar5iv
---

# Attention Is All You Need

## Abstract

The dominant sequence transduction models are based on complex recurrent or 
convolutional neural networks... We propose a new simple network architecture, 
the Transformer, based solely on attention mechanisms...

## 1 Introduction

Recurrent neural networks, long short-term memory and gated recurrent neural 
networks in particular, have been firmly established as state of the art...

The Transformer follows this overall architecture using stacked self-attention 
and point-wise, fully connected layers for both the encoder and decoder, shown 
in the left and right halves of Figure $1$, respectively.

$$
\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V
$$
```

---

## 📦 Installation

### Method 1: Chrome Web Store (Recommended)

> 🚧 Coming soon, stay tuned

### Method 2: Developer Mode Installation

```bash
# 1. Clone repository
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md

# 2. Install dependencies
npm install

# 3. Build
npm run build
```

Then in Chrome:

1. Open `chrome://extensions/`
2. Enable **"Developer mode"** in the top right
3. Click **"Load unpacked"**
4. Select the `dist` directory in the project

---

## 🎨 Use Cases

### Scenario 1: Obsidian Knowledge Base

Set Chrome's default download path to your Obsidian Vault directory:

```
Chrome Settings → Downloads → Location → Select your Obsidian Vault
```

After clicking **Save as Markdown**, papers appear directly in Obsidian with auto-rendered formulas, ready for annotation.

### Scenario 2: Notion Paper Management

1. Download Markdown file
2. Drag and drop to Notion page
3. Notion auto-imports (formulas need KaTeX blocks)

### Scenario 3: Batch Paper Organization

Use **Save PDF (Renamed)** to batch download papers, all files auto-named by title, goodbye to `2312.xxxxx.pdf` chaos.

### Scenario 4: Offline Reading

Markdown files are small and load fast, readable in any text editor, no PDF reader needed.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension (MV3)                   │
├─────────────────────────────────────────────────────────────┤
│  Content Script          Background Worker       Popup UI   │
│  ┌─────────────┐        ┌──────────────┐      ┌─────────┐  │
│  │ Inject Btns │◄──────►│ Conversion   │◄────►│ Settings│  │
│  │ Extract Meta│        │ Scheduler    │      │ Stats   │  │
│  │ HTML→MD     │        │ Msg Router   │      └─────────┘  │
│  │ Conversion  │        │ Download Mgr │                   │
│  └─────────────┘        └──────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │  ar5iv   │   │  arXiv   │   │ Chrome APIs  │
        │  HTML    │   │  PDF     │   │ Storage/DL   │
        └──────────┘   └──────────┘   └──────────────┘
```

### Two-Tier Fallback Strategy

```
User clicks "Save as Markdown"
              │
              ▼
    ┌─────────────────────┐
    │  Tier 1: ar5iv      │ ← 85% of cases, <1s, fully local
    │  HTML → Markdown    │
    └─────────────────────┘
              │ Fails (new paper/ar5iv not indexed)
              ▼
    ┌─────────────────────┐
    │  Tier 2: PDF        │ ← Fallback, always works
    │  Renamed Download   │
    └─────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Build** | Webpack 5 + Babel |
| **Conversion Engine** | [Turndown](https://github.com/mixmark-io/turndown) + GFM Plugin |
| **DOM Parsing** | [linkedom](https://github.com/WebReflection/linkedom) (only 200KB, vs jsdom 5MB) |
| **Data Source** | [ar5iv](https://ar5iv.org) — arXiv official HTML5 rendering service |
| **Storage** | Chrome Storage API |

---

## 📁 Project Structure

```
arxiv-md/
├── src/
│   ├── background/           # Service Worker
│   ├── content/              # Content Script (injected into arXiv pages)
│   ├── core/
│   │   ├── converter/        # Conversion Engine
│   │   │   ├── ar5iv-converter.js
│   │   │   └── index.js      # Main Controller (fallback strategy)
│   │   └── metadata-extractor.js
│   ├── ui/
│   │   ├── popup/            # Popup Window
│   │   └── settings/         # Settings Page
│   ├── utils/                # Utility Functions
│   └── config/               # Configuration Constants
├── dist/                     # Build Output
└── docs/                     # Documentation
```

---

## 🛠️ Development

```bash
# Development mode (hot reload)
npm run dev

# Production build
npm run build

# Code linting
npm run lint

# Package extension (generate ZIP)
npm run package
```

---

## ❓ FAQ

<details>
<summary><strong>Q: Why does the "Save as Markdown" button sometimes not show?</strong></summary>

The extension auto-detects if ar5iv has indexed the paper. For newly published papers (usually takes 1-2 days), ar5iv hasn't generated the HTML version yet, so the button auto-hides. You can use **Save PDF (Renamed)** first.

</details>

<details>
<summary><strong>Q: Converted Markdown formulas don't display in Obsidian?</strong></summary>

Make sure Obsidian has LaTeX formula rendering enabled. Converted formulas use standard LaTeX syntax:
- Inline formulas: `$...$`
- Block formulas: `$$...$$`

</details>

<details>
<summary><strong>Q: Images not displaying?</strong></summary>

Image links point to ar5iv CDN, requires internet to view. For offline use, manually download images locally.

</details>

<details>
<summary><strong>Q: Which browsers are supported?</strong></summary>

Currently supported:
- ✅ Chrome (recommended)
- ✅ Edge (Chromium-based)
- 🚧 Firefox (in development)

</details>

<details>
<summary><strong>Q: What to do if conversion fails?</strong></summary>

1. Check network connection
2. Refresh page and retry
3. Use **Save PDF (Renamed)** as backup
4. Report issue on [GitHub Issues](https://github.com/Tendo33/arxiv-md/issues)

</details>

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](docs/QUICK_START.md) | 5-minute getting started guide |
| [Architecture](docs/ARCHITECTURE.md) | Technical architecture and design decisions |
| [Development Guide](docs/DEVELOPMENT.md) | Development workflow for contributors |
| [FAQ](docs/FAQ.md) | 50+ questions answered |
| [Privacy Policy](PRIVACY.md) | Data usage explanation |

---

## 🙏 Acknowledgments

- [ar5iv](https://ar5iv.org) — arXiv official HTML5 rendering service
- [Turndown](https://github.com/mixmark-io/turndown) — HTML → Markdown conversion library
- [linkedom](https://github.com/WebReflection/linkedom) — Lightweight DOM parsing
- [arXiv](https://arxiv.org) — Open access preprint repository

---

## 📄 License

This project is open source under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Tendo33">SimonSun</a>
</p>

<p align="center">
  If this project helps you, please give it a ⭐ Star!
</p>
