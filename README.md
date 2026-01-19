<p align="center">
  <img src="./docs/icons/arxiv_md.png" alt="arXiv to Markdown" width="120">
</p>

<h1 align="center">arXiv to Markdown</h1>

<p align="center">
  <strong>Convert arXiv papers to Markdown in one click. Perfect for Obsidian & Notion.</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd"><img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-00C853" alt="Manifest V3">
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How it Works</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="./README_CN.md">中文文档</a>
</p>

---

## 🎯 Why this?

Turn `2312.12345.pdf` into `Attention Is All You Need(2017).md` instantly.

- **Readable**: Clean Markdown format for Obsidian, Notion, or VS Code.
- **Searchable**: Full-text search works perfectly in your notes.
- **Accurate**: Preserves LaTeX formulas (`$E=mc^2$`) and images.

## ✨ Features

- **⚡ Fast**: Converts most papers in < 1 second using [ar5iv](https://ar5iv.org).
- **🧠 MinerU Integration**: Optional high-precision PDF parsing for complex layouts (requires API Key).
- **🔄 Smart Fallback**:
  1. **ar5iv**: Best speed & formula quality (HTML5 based).
  2. **MinerU**: Best layout analysis (PDF AI based).
  3. **PDF**: Fallback to auto-renamed PDF if conversion fails.
- **📋 Task Manager**: Track background conversion tasks, retries, and downloads.
- **🔒 Privacy First**: ar5iv conversion happens 100% locally in your browser.

## 🏗️ How it Works

We use a **Multi-Tier Strategy** to ensure you always get the best result:

1. **Tier 1 (ar5iv)**: Fetches HTML5 from ar5iv.org and converts to Markdown locally.
   - *Pros*: Instant, editable formulas, perfect for most papers.
2. **Tier 2 (MinerU)**: Uses MinerU AI service to parse the PDF.
   - *Pros*: Handles complex double-column layouts and tables better.
   - *Note*: Requires an API Token in settings.
3. **Tier 3 (PDF)**: Downloads the original PDF with a clean filename.
   - *Format*: `(Year) Title - Authors.pdf`

## 📦 Installation

### Option 1: Chrome Web Store (Recommended)
[**Install from Chrome Web Store**](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd)

### Option 2: Manual Installation (For Developers)
1. Clone the repo:
   ```bash
   git clone https://github.com/Tendo33/arxiv-md.git
   cd arxiv-md
   npm install
   npm run build
   ```
2. Open Chrome -> `chrome://extensions/`
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `dist` folder.

## 🚀 Usage

1. Open any **arXiv paper page** (e.g., [1706.03762](https://arxiv.org/abs/1706.03762)).
2. Click the **"Save as Markdown"** (Purple) button.
   - *Or click "Save PDF" (Orange) for just the PDF.*
3. The file will download to your default downloads folder.

> **Tip**: For Obsidian users, set your Chrome download location to your Vault's inbox folder.

## ⚙️ Configuration

Click the extension icon in the toolbar to access settings:

- **Conversion Mode**:
  - `Smart (Default)`: Tries ar5iv first, then PDF.
  - `MinerU Priority`: Forces MinerU for all papers (slower but more accurate layout).
- **MinerU Token**:
  - Get your token from [MinerU Dashboard](https://github.com/opendatalab/MinerU) (or compatible service) and paste it here to enable AI parsing.

## 🛠️ Development

- `npm run dev`: Watch mode for development.
- `npm run build`: Production build.
- `npm run package`: Create zip for store publication.

## 📄 License

MIT License. Made with ❤️ by [SimonSun](https://github.com/Tendo33).
