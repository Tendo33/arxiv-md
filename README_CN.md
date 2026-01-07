<p align="center">
  <img src="./docs/icons/arxiv_md.png" alt="arXiv to Markdown" width="120">
</p>

<h1 align="center">arXiv to Markdown</h1>

<p align="center">
  <strong>一键将 arXiv 论文转换为 Markdown，完美保留 LaTeX 公式。</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd"><img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension"></a>
  <a href="#"><img src="https://img.shields.io/badge/Manifest-V3-00C853" alt="Manifest V3"></a>
</p>

<p align="center">
  <a href="#-快速开始">快速开始</a> •
  <a href="#-功能特性">功能特性</a> •
  <a href="#-安装">安装</a> •
  <a href="./README.md">English</a>
</p>

---

## 🎯 为什么需要它？

别再手动重命名 `2312.12345.pdf` 这种文件了。
**arXiv to Markdown** 让你瞬间获得 `Attention Is All You Need(2017).md`。

- **易读**：在 Obsidian, Notion 或 VS Code 中直接编辑。
- **易搜**：全文检索瞬间完成。
- **整洁**：LaTeX 公式完美保留。

## ✨ 功能特性

- **⚡ 极速**：绝大多数论文在 1 秒内完成转换。
- **🧮 LaTeX 支持**：完美保留行内 `$E=mc^2$` 和块级 `$$...$$` 公式。
- **🖼️ 图片保留**：保留图片（链接至 ar5iv CDN）。
- **🧠 MinerU**: 高精度 PDF 布局分析与提取（可选）。
- **🔄 智能降级**：
    1. **ar5iv**: 基于 HTML5 的快速转换。
    2. **MinerU**: 智能 PDF 解析（需 API Key）。
    3. **PDF**: 兜底下载重命名好的 PDF。
- **🔒 隐私**：100% 本地处理（ar5iv 模式）。不收集任何数据。

## 🚀 快速开始

1. **安装** 插件。
2. 访问任意 **arXiv 论文页面** (例如 [1706.03762](https://arxiv.org/abs/1706.03762))。
3. 点击 **"Save as Markdown"** (紫色按钮) 或 **"Save PDF"** (橙色按钮)。

> **注意**：对于刚发布（< 2天）的新论文，如果 ar5iv 尚未处理，Markdown 按钮可能会隐藏。此时请使用 "Save PDF"。

## 📦 安装

### 开发者模式 (当前)

1. 克隆本仓库：
   ```bash
   git clone https://github.com/Tendo33/arxiv-md.git
   cd arxiv-md
   npm install
   npm run build
   ```
2. 打开 Chrome -> `chrome://extensions/`
3. 开启右上角的 **开发者模式**。
4. 点击 **加载已解压的扩展程序** 并选择 `dist` 目录。

[**前往 Chrome 网上应用店下载**](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd)

## 🏗️ 工作原理

我们采用 **多层策略**：
1. **Tier 1 (ar5iv)**：从 [ar5iv.org](https://ar5iv.org) 获取 HTML5 并使用 Turndown 在本地转换为 Markdown。追求速度和公式质量的最佳选择。
2. **Tier 2 (MinerU)**：使用 [MinerU](https://github.com/opendatalab/MinerU) 提取服务进行高精度 PDF 解析。适合复杂布局（需配置）。
3. **Tier 3 (PDF)**：如果所有转换方式都失败，则下载 PDF 并自动重命名（例如 `(2017) Title - Author.pdf`）。

## 🔌 集成指南

### Obsidian
1. 将 Chrome 的默认下载路径更改为你的 Obsidian Vault 目录（例如 `D:\Obsidian\Papers`）。
2. 下载的 Markdown 文件将直接出现在 Obsidian 中，公式自动渲染。

### Notion
1. 下载 Markdown 文件。
2. 将其拖放到 Notion 页面中。
3. Notion 会自动导入内容（数学公式可能需要微调）。

## 📄 许可证

MIT License. Made with ❤️ by [SimonSun](https://github.com/Tendo33).

