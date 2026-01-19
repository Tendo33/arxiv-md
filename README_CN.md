<p align="center">
  <img src="./docs/icons/arxiv_md.png" alt="arXiv to Markdown" width="120">
</p>

<h1 align="center">arXiv to Markdown</h1>

<p align="center">
  <strong>一键将 arXiv 论文转换为 Markdown，完美保留 LaTeX 公式。Obsidian 和 Notion 的最佳伴侣。</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd"><img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-00C853" alt="Manifest V3">
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-工作原理">工作原理</a> •
  <a href="#-安装">安装指南</a> •
  <a href="#-配置">配置指南</a> •
  <a href="./README.md">English</a>
</p>

---

## 🎯 为什么需要它？

告别 `2312.12345.pdf` 这种无意义的文件名。
**arXiv to Markdown** 让你瞬间获得 `Attention Is All You Need(2017).md`。

- **易读**：生成的 Markdown 完美适配 Obsidian、Notion 或 VS Code。
- **易搜**：本地笔记全文检索，知识不再丢失。
- **精准**：完美保留 LaTeX 公式（`$E=mc^2$`）和论文插图。

## ✨ 功能特性

- **⚡ 极速转换**：基于 [ar5iv](https://ar5iv.org) 技术，绝大多数论文在 1 秒内完成。
- **🧠 MinerU 集成**：可选的高精度 AI PDF 解析，擅长处理复杂排版（需 API Key）。
- **🔄 智能降级策略**：
  1. **ar5iv**：优先使用，速度最快，公式可编辑（HTML5 转换）。
  2. **MinerU**：当 HTML 获取失败时，使用 AI 解析 PDF（布局更精准）。
  3. **PDF**：如果转换都失败，自动下载重命名好的 PDF 文件。
- **📋 任务管理**：内置任务中心，实时查看后台转换进度、下载状态及失败重试。
- **🔒 隐私安全**：ar5iv 模式下所有转换逻辑均在本地浏览器完成。

## 🏗️ 工作原理

我们采用 **多层降级策略 (Multi-Tier Strategy)** 来确保最佳体验：

1. **Tier 1 (ar5iv)**：获取 ar5iv 的 HTML5 内容并在本地转为 Markdown。
   - *优势*：秒级响应，公式完美，适合绝大多数论文。
2. **Tier 2 (MinerU)**：调用 MinerU AI 服务解析原始 PDF。
   - *优势*：对双栏、复杂表格的还原度更高。
   - *注意*：需要在设置中配置 API Token。
3. **Tier 3 (PDF)**：兜底方案，下载原始 PDF 并规范化命名。
   - *格式*：`(Year) Title - Authors.pdf`

## 📦 安装指南

### 方式 1：Chrome 应用商店（推荐）
[**点击前往 Chrome Web Store 下载**](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd)

### 方式 2：手动安装（开发者）
1. 克隆仓库：
   ```bash
   git clone https://github.com/Tendo33/arxiv-md.git
   cd arxiv-md
   npm install
   npm run build
   ```
2. 打开 Chrome -> `chrome://extensions/`
3. 开启右上角的 **开发者模式 (Developer mode)**。
4. 点击 **加载已解压的扩展程序 (Load unpacked)** 并选择 `dist` 目录。

## 🚀 使用指南

1. 访问任意 **arXiv 论文页面** (例如 [1706.03762](https://arxiv.org/abs/1706.03762))。
2. 点击页面右侧的 **"Save as Markdown"** (紫色按钮)。
   - *或点击 "Save PDF" (橙色按钮) 仅下载 PDF。*
3. 文件将自动下载到你的默认下载目录。

> **提示**：Obsidian 用户建议将 Chrome 默认下载路径设置为你的 Vault 文件夹，实现“下载即导入”。

## ⚙️ 配置指南

点击浏览器工具栏的插件图标进入设置：

- **转换模式 (Conversion Mode)**：
  - `Smart (Default)`：智能模式，优先使用 ar5iv，失败后尝试 PDF。
  - `MinerU Priority`：优先使用 MinerU AI 解析（更精准但较慢）。
- **MinerU Token**：
  - 在 [MinerU 平台](https://github.com/opendatalab/MinerU) 获取 API Token 并填入，以解锁 AI 解析能力。

## 🛠️ 开发说明

- `npm run dev`: 开发模式（监听文件变更）。
- `npm run build`: 生产环境构建。
- `npm run package`: 打包 zip 用于发布。

## 📄 许可证

MIT License. Made with ❤️ by [SimonSun](https://github.com/Tendo33).
