<p align="center">
  <img src="./docs/icons/arxiv_md.png" alt="arXiv to Markdown" width="120">
</p>

<h1 align="center">arXiv to Markdown</h1>

<p align="center">
  <strong>Convert arXiv papers to Markdown in one click. Perfect LaTeX formulas.</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd"><img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension"></a>
  <a href="#"><img src="https://img.shields.io/badge/Manifest-V3-00C853" alt="Manifest V3"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="./README_CN.md">中文文档</a>
</p>

---

## 🎯 Why?

Stop manually renaming PDFs like `2312.12345.pdf`.
**arXiv to Markdown** gives you `Attention Is All You Need(2017).md` instantly.

- **Readable**: Edit in Obsidian, Notion, or VS Code.
- **Searchable**: Full-text search works instantly.
- **Clean**: LaTeX formulas are preserved perfectly.

## ✨ Features

- **⚡ Fast**: Converts most papers in < 1 second.
- **🧮 LaTeX Support**: Preserves inline `$E=mc^2$` and block `$$...$$` formulas.
- **🖼️ Images**: Keeps images (linked to ar5iv CDN).
- **🧠 MinerU**: High-accuracy PDF layout analysis and extraction (Optional).
- **🔄 Smart Fallback**:
    1. **ar5iv**: Fast HTML5 based conversion.
    2. **MinerU**: Intelligent PDF parsing (requires API key).
    3. **PDF**: Fallback to properly named PDF.
- **🔒 Private**: 100% local processing (ar5iv mode). No data collection.

## 🚀 Quick Start

1. **Install** the extension.
2. Go to any **arXiv paper page** (e.g., [1706.03762](https://arxiv.org/abs/1706.03762)).
3. Click **"Save as Markdown"** (purple button) or **"Save PDF"** (orange button).

> **Note**: For very new papers (published < 2 days ago), the Markdown button might be hidden if ar5iv hasn't processed them yet. Use "Save PDF" instead.

## 📦 Installation

### Developer Mode (Current)

1. Clone this repo:
   ```bash
   git clone https://github.com/Tendo33/arxiv-md.git
   cd arxiv-md
   npm install
   npm run build
   ```
2. Open Chrome -> `chrome://extensions/`
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `dist` folder.

[**Download from Chrome Web Store**](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd)

## 🏗️ How it Works

We use a **Multi-Tier Strategy**:
1. **Tier 1 (ar5iv)**: Fetch HTML5 from [ar5iv.org](https://ar5iv.org) and convert to Markdown locally using Turndown. Best for speed and formula quality.
2. **Tier 2 (MinerU)**: Use [MinerU](https://github.com/opendatalab/MinerU) extraction service for high-precision PDF parsing. Best for complex layouts (requires configuration).
3. **Tier 3 (PDF)**: If all conversion methods fail, download the PDF and rename it automatically (e.g. `(2017) Title - Author.pdf`).

## 🔌 Integrations

### Obsidian
1. Change Chrome's default download path to your Obsidian Vault (e.g., `D:\Obsidian\Papers`).
2. Downloaded Markdown files will appear directly in Obsidian with auto-rendered formulas.

### Notion
1. Download the Markdown file.
2. Drag and drop it into a Notion page.
3. Notion will auto-import the content (math formulas may need minor adjustments).

## 📄 License

MIT License. Made with ❤️ by [SimonSun](https://github.com/Tendo33).
