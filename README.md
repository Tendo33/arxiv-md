# arXiv to Markdown

> 🚀 一键将 arXiv 论文转换为 Markdown，支持智能三层降级策略，保证最佳转换质量

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)

## ✨ 特性

- **🚀 极速转换**：85% 的论文在 1 秒内完成转换（ar5iv + 本地 Turndown）
- **🔥 智能降级**：ar5iv 失败时自动调用 MinerU 深度解析
- **💎 质量保证**：完美处理 LaTeX 公式、表格、图片
- **🔒 隐私优先**：默认本地处理，不发送数据到外部（可选 MinerU 增强）
- **📊 统计面板**：实时查看转换成功率和使用情况

## 🎯 三层智能降级架构

```
Tier 1 (Fast Path - 85% 场景):  
  ar5iv HTML + 本地 Turndown
  ↓ <1 秒，完全免费，隐私友好

Tier 2 (Quality Path - 15% 场景):  
  MinerU API 解析原始 PDF
  ↓ 5-15 秒，可能有配额，质量极高

Tier 3 (Fallback):  
  下载重命名的 PDF
  ↓ 始终有效
```

## 📦 安装

### 从 Chrome Web Store 安装（推荐）

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
2. 点击"添加至 Chrome"

### 手动安装（开发者）

```bash
# 克隆仓库
git clone https://github.com/yourusername/arxiv-md.git
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

## 🚀 使用方法

### 快速开始

1. 访问任意 arXiv 论文页面（例如：https://arxiv.org/abs/1706.03762）
2. 点击页面上的 **"保存为 Markdown"** 按钮
3. 等待转换完成（1-15 秒，取决于转换方式）
4. Markdown 文件自动下载到本地

### 配置 MinerU（可选，推荐）

1. 访问 [mineru.net](https://mineru.net) 注册账号
2. 获取 API Token
3. 点击插件图标 → 设置
4. 输入 Token 并保存

**配置后的优势：**
- ar5iv 无法转换的论文自动使用 MinerU 深度解析
- 完美处理复杂公式、表格、图片
- 免费账号每天 2000 页解析额度

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
- **API**: MinerU, ar5iv
- **存储**: Chrome Storage API

## 📖 使用场景

### 场景 1：日常论文阅读

- **需求**：快速保存论文到 Obsidian/Notion
- **方案**：使用默认的"质量模式"
- **体验**：85% 论文 <1 秒完成，15% 自动深度解析

### 场景 2：批量论文处理

- **需求**：整理大量论文到知识库
- **方案**：配置 MinerU Token
- **优势**：所有论文都能转换，质量统一

### 场景 3：隐私优先

- **需求**：不希望论文数据发送到外部
- **方案**：使用"快速模式"
- **体验**：100% 本地处理，ar5iv 失败时下载 PDF

## ❓ 常见问题

**Q: 转换失败怎么办？**  
A: 插件会自动降级。ar5iv 失败时会调用 MinerU（如已配置），否则下载 PDF。

**Q: MinerU Token 是必须的吗？**  
A: 不是。不配置 Token 插件依然可用，只是部分论文可能无法转换为 Markdown。

**Q: 转换的 Markdown 包含图片吗？**  
A: 包含。图片以 ar5iv CDN 链接形式保存在 Markdown 中（需联网查看）。

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
- [MinerU](https://github.com/opendatalab/mineru) - 强大的 PDF 解析工具
- [Turndown](https://github.com/mixmark-io/turndown) - HTML → Markdown 转换
- [Mozilla Readability](https://github.com/mozilla/readability) - 内容提取算法

---

Made with ❤️ by [Jinfeng Sun](https://github.com/yourusername)

如果这个项目对你有帮助，请给个 ⭐️ Star！