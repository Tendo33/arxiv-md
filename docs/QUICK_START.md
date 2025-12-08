# Quick Start Guide | 快速开始指南

Welcome to arXiv to Markdown! This guide will help you get started in 5 minutes.

欢迎使用 arXiv to Markdown！本指南将帮助你在 5 分钟内开始使用。

---

## 📦 Installation | 安装

### Method 1: Chrome Web Store (Recommended) | 方式 1: Chrome Web Store（推荐）

1. Visit [Chrome Web Store](https://chrome.google.com/webstore) (Coming soon)
2. Click "Add to Chrome"
3. Confirm permissions and complete installation

---

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore)（即将推出）
2. 点击"添加至 Chrome"按钮
3. 确认权限并完成安装

### Method 2: Manual Installation (Developer) | 方式 2: 手动安装（开发版）

```bash
# Clone project | 克隆项目
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md

# Install dependencies | 安装依赖
npm install

# Build extension | 构建扩展
npm run build
```

Then in Chrome | 然后在 Chrome 中：

1. Open `chrome://extensions/` | 打开 `chrome://extensions/`
2. Enable "Developer mode" in the top right | 开启右上角的"开发者模式"
3. Click "Load unpacked" | 点击"加载已解压的扩展程序"
4. Select the `dist` directory in the project | 选择项目中的 `dist` 目录

---

## 🚀 Basic Usage | 基础使用

### Just Three Steps | 只需三步，开始转换

#### Step 1: Visit a Paper | 第一步：访问论文

Open any arXiv paper page, for example:

打开任意 arXiv 论文页面，例如：

```
https://arxiv.org/abs/1706.03762
```

💡 **Tip**: Make sure you're on the Abstract page (URL contains `/abs/`), not the PDF page.

💡 **提示**：确保是 Abstract 页面（URL 包含 `/abs/`），而非 PDF 页面。

#### Step 2: Click the Button | 第二步：点击按钮

Find the purple **"Save as Markdown"** button near the top of the page (next to PDF download links) and click it.

在页面顶部（PDF 下载链接旁）找到紫色的 **"Save as Markdown"** 按钮并点击。

> 💡 **Note**: If the button doesn't appear, it means ar5iv hasn't indexed this paper yet (usually for newly published papers). Please use the **"Save PDF"** function instead.

> 💡 **注意**：如果按钮未显示，说明 ar5iv 尚未收录该论文（通常是刚发布的新论文）。此时请使用 **"Save PDF"** 功能。

#### Step 3: Wait for Download | 第三步：等待下载

- **Fast conversion** (85% of papers): <1 second | **快速转换**（85% 论文）：<1 秒完成
- File downloads automatically | 文件自动下载
- Filename format: `(Year) Title - Author.md` | 文件名格式：`(年份) 标题 - 作者.md`

🎉 **Done!** You've successfully converted a paper to Markdown.

🎉 **完成！** 你已经成功将论文转换为 Markdown。

---

## 💡 Practical Tips | 实用技巧

### Integrate with Obsidian | 集成到 Obsidian

Change Chrome's default download path to your Obsidian Vault directory:

在 Chrome 设置中将默认下载路径改为 Obsidian Vault 目录：

```
Chrome Settings → Downloads → Location → Select D:\Obsidian\Papers
Chrome 设置 → 下载内容 → 位置 → 选择 D:\Obsidian\Papers
```

Downloaded Markdown files will appear directly in Obsidian with auto-rendered formulas.

下载的 Markdown 会直接出现在 Obsidian 中，公式自动渲染。

### Integrate with Notion | 集成到 Notion

1. Download Markdown file | 下载 Markdown 文件
2. Drag and drop to Notion page | 拖拽到 Notion 页面
3. Notion auto-imports (formulas may need manual adjustment) | Notion 自动导入（公式需手动调整）

---

## ❓ Troubleshooting | 遇到问题？

### Quick Self-Check | 快速自查

- **Button doesn't appear** | **按钮没出现**：Might be a new paper ar5iv hasn't indexed yet (normal), or try refreshing the page | 可能是新论文 ar5iv 尚未收录（正常现象），或请刷新页面重试
- **Conversion failed** | **转换失败**：Open console (F12) to check errors | 打开控制台（F12）查看错误
- **Very slow** | **速度很慢**：This is normal for some complex papers | 某些复杂论文属于正常现象

### Detailed Help | 详细帮助

- 📖 [Full FAQ](FAQ.md) - 50+ common questions answered | 50+ 个常见问题解答
- 🐛 [GitHub Issues](https://github.com/Tendo33/arxiv-md/issues) - Report bugs | 报告 Bug
- 💬 [Discussions](https://github.com/Tendo33/arxiv-md/discussions) - Ask questions | 提问交流

---

Happy reading! 📚✨

祝你阅读愉快！📚✨
