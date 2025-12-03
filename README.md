# arXiv to Markdown

> 🚀 一键将 arXiv 论文转换为 Markdown，支持智能三层降级策略，保证最佳转换质量

<img src="./docs/arxiv_md.png" alt="arXiv to Markdown" width="100">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-即将推出-blue)](https://chrome.google.com/webstore)

## 📦 项目状态

- 🚧 开发版本：v1.0.0
- 📦 Chrome Web Store：即将推出
- 🔓 开源协议：MIT License
- 🌟 GitHub Star：欢迎 Star 支持

## ✨ 特性

- **🚀 极速转换**：85% 的论文在 1 秒内完成转换（ar5iv + 本地 Turndown）
- **🧠 智能交互**：自动检测 ar5iv 可用性，智能管理按钮显示状态
- **🌍 多语言支持**：支持中文/英文界面一键切换
- **📄 一键保存 PDF**：支持一键下载按标题命名的 PDF 文件
- **💎 质量保证**：完美处理 LaTeX 公式、表格、图片
- **🔒 隐私优先**：100% 本地处理，不发送数据到外部服务器
- **📊 统计面板**：实时查看转换成功率和使用情况

## 🎯 两层降级架构

```
Tier 1 (Fast Path - 85% 场景):
  ar5iv HTML + 本地 Turndown
  ↓ <1 秒，完全免费，隐私友好

Tier 2 (Fallback):
  下载按标题重命名的 PDF
  ↓ 始终有效
```

## 📦 安装

### 从 Chrome Web Store 安装（推荐）

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore)（即将推出）
2. 点击"添加至 Chrome"

### 手动安装（开发者）

```bash
# 克隆仓库
git clone https://github.com/[你的GitHub用户名]/arxiv-md.git
cd arxiv-md

# 安装依赖
npm install

# 构建插件
npm run build

# 在 Chrome 中加载：
# 1. 打开 chrome://extensions/
# 2. 开启"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择 dist 目录
```

## 📚 文档导航

- [快速开始](docs/QUICK_START.md) - 5 分钟快速上手
- [完整安装指南](INSTALL.md) - 详细的安装步骤和故障排查
- [架构设计](docs/ARCHITECTURE.md) - 技术架构和设计决策
- [开发指南](docs/DEVELOPMENT.md) - 参与贡献的开发流程
- [常见问题](docs/FAQ.md) - 使用中的常见问题解答
- [贡献指南](CONTRIBUTING.md) - 如何为项目做贡献

## 🚀 使用方法

### 快速开始

1. 访问任意 arXiv 论文页面（例如：https://arxiv.org/abs/1706.03762）
2. 点击页面上的 **"保存为 Markdown"** 或 **"保存 PDF"** 按钮
3. 等待处理完成（通常 <1 秒）
4. 文件自动下载到本地，文件名格式：`(年份) 标题 - 作者.扩展名`

### 两个按钮的区别

- **保存为 Markdown**：将论文转换为 Markdown 格式，便于在 Obsidian/Notion 等工具中阅读和编辑
- **保存 PDF**：直接下载 PDF，但使用论文标题重命名，方便管理

## 🛠️ 开发

### 项目结构

```
arxiv-md/
├── src/
│   ├── background/          # Background Service Worker
│   ├── content/             # Content Script（注入 arXiv 页面）
│   ├── core/
│   │   ├── converter/       # 核心转换引擎
│   │   │   ├── ar5iv-converter.js    # ar5iv → Markdown
│   │   │   ├── mineru-client.js      # MinerU API 客户端
│   │   │   └── index.js              # 主转换器（三层架构）
│   │   └── metadata-extractor.js     # 元数据提取
│   ├── ui/
│   │   ├── popup/           # 弹出窗口
│   │   └── settings/        # 设置页面
│   ├── utils/               # 工具函数
│   ├── config/              # 配置常量
│   └── manifest.json        # Chrome Extension 配置
├── webpack.config.js        # Webpack 配置
└── package.json

```

### 开发命令

```bash
# 开发模式（自动编译）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 打包扩展
npm run package
```

### 技术栈

- **框架**: Vanilla JavaScript（ES6+）
- **构建**: Webpack 5 + Babel
- **转换引擎**:
  - [Turndown](https://github.com/mixmark-io/turndown) - HTML → Markdown
  - [Mozilla Readability](https://github.com/mozilla/readability) - 内容提取
  - [linkedom](https://github.com/WebReflection/linkedom) - 轻量级 DOM 解析（Service Worker 环境，仅 200KB vs jsdom 5MB）
- **API**: MinerU, ar5iv
- **存储**: Chrome Storage API

## 📖 使用场景

### 场景 1：日常论文阅读

- **需求**：快速保存论文到 Obsidian/Notion
- **方案**：点击"保存为 Markdown"
- **体验**：85% 论文 <1 秒完成，剩余自动保存 PDF

### 场景 2：批量论文整理

- **需求**：整理大量论文到知识库
- **方案**：使用"保存 PDF"按钮批量下载
- **优势**：所有文件自动按标题命名，易于管理

### 场景 3：隐私优先

- **需求**：不希望论文数据发送到外部
- **方案**：本插件默认完全本地处理
- **体验**：100% 隐私保护，无任何数据上传

## ❓ 常见问题

**Q: 转换失败怎么办？**  
A: 插件会自动降级。ar5iv 转换失败时会自动保存为 PDF。

**Q: 为什么"保存为 Markdown"按钮有时候不显示？**  
A: 插件会自动检测 ar5iv 是否已收录该论文。对于刚刚发布的论文（通常需要 1-2 天生成 HTML），ar5iv 可能尚未准备好。此时插件会自动隐藏 Markdown 按钮，避免转换失败。您可以先使用"保存 PDF"功能。

**Q: 为什么有两个按钮？**  
A: "保存为 Markdown" 用于知识管理，"保存 PDF" 用于快速收藏原文。

**Q: 转换的 Markdown 包含图片吗？**  
A: 包含。图片以 ar5iv CDN 链接形式保存在 Markdown 中（需联网查看）。

**Q: PDF 文件名如何生成？**  
A: 自动按 `(年份) 标题 - 第一作者姓氏.pdf` 格式命名，方便整理。

**Q: 支持哪些浏览器？**  
A: 目前仅支持 Chrome/Edge（Chromium 内核）。Firefox 版本正在开发中。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。

## 🙏 致谢

- [ar5iv](https://ar5iv.org) - 提供 HTML5 版本的 arXiv 论文
- [Turndown](https://github.com/mixmark-io/turndown) - HTML → Markdown 转换
- [Mozilla Readability](https://github.com/mozilla/readability) - 内容提取算法
- [arXiv](https://arxiv.org) - 开放获取的预印本论文库

---

Made with ❤️ by [Jinfeng Sun](https://github.com/[你的GitHub用户名])

如果这个项目对你有帮助，请给个 ⭐️ Star！
