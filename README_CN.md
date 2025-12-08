<p align="center">
  <img src="./docs/icons/arxiv_md.png" alt="arXiv to Markdown" width="120">
</p>

<h1 align="center">arXiv to Markdown</h1>

<p align="center">
  <strong>一键将 arXiv 论文转换为 Markdown，完美保留 LaTeX 公式</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension"></a>
  <a href="#"><img src="https://img.shields.io/badge/Manifest-V3-00C853" alt="Manifest V3"></a>
  <a href="#"><img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version"></a>
</p>

<p align="center">
  <a href="#-快速开始">快速开始</a> •
  <a href="#-功能特性">功能特性</a> •
  <a href="#-安装方式">安装</a> •
  <a href="#-使用场景">使用场景</a> •
  <a href="#-常见问题">FAQ</a> •
  <a href="./README.md">English</a>
</p>

---

## 🎯 为什么需要这个插件？

作为研究人员，你是否遇到过这些问题？

| 痛点 | 传统方式 | 使用本插件 |
|------|----------|------------|
| 📄 论文文件名混乱 | `2312.12345.pdf` | `Attention Is All You Need(2017).md` |
| 📝 无法在笔记软件中编辑 | PDF 只读，复制公式乱码 | Markdown 直接编辑，公式完美渲染 |
| 🔍 知识库检索困难 | PDF 全文搜索慢 | Markdown 秒级检索 |
| ⏱️ 整理论文耗时 | 手动重命名、转换格式 | 一键完成，<1 秒 |

**arXiv to Markdown** 让你专注于研究本身，而非文件管理。

---

## ✨ 功能特性

### 核心功能

- **⚡ 极速转换** — 85% 论文在 1 秒内完成转换
- **🧮 完美公式** — LaTeX 数学公式完整保留，支持行内/块级公式
- **📊 表格支持** — 自动转换为 Markdown 表格格式
- **🖼️ 图片保留** — 图片链接指向 ar5iv CDN，无需本地存储
- **📝 智能命名** — 自动按 `标题(年份).md` 格式命名

### 智能特性

- **🧠 自动检测** — 智能检测 ar5iv 可用性，新论文自动隐藏 Markdown 按钮
- **🔄 自动降级** — ar5iv 不可用时自动保存为重命名的 PDF
- **🌍 多语言界面** — 支持中文/英文一键切换
- **🔔 桌面通知** — 转换完成后系统通知提醒（可关闭）

### 隐私优先

- **🔒 100% 本地处理** — 不上传任何数据到外部服务器
- **🚫 零追踪** — 不收集用户行为、浏览历史
- **📦 开源透明** — MIT 协议，代码完全公开

---

## 🚀 快速开始

### 三步上手

```
1️⃣ 安装插件 → 2️⃣ 访问 arXiv 论文 → 3️⃣ 点击按钮下载
```

<details>
<summary><strong>📸 查看操作演示</strong></summary>

1. 访问任意 arXiv 论文页面（如 https://arxiv.org/abs/1706.03762）
2. 在页面的 **Submission history** 下方找到两个按钮：
   - 🟣 **Save as Markdown** — 转换为 Markdown
   - 🟠 **Save PDF (Renamed)** — 下载重命名的 PDF
3. 点击按钮，文件自动下载

</details>

### 输出示例

转换后的 Markdown 文件包含：

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

## 📦 安装方式

### 方式一：Chrome Web Store（推荐）

> 🚧 即将上线，敬请期待

### 方式二：开发者模式安装

```bash
# 1. 克隆仓库
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md

# 2. 安装依赖
npm install

# 3. 构建
npm run build
```

然后在 Chrome 中：

1. 打开 `chrome://extensions/`
2. 开启右上角 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择项目中的 `dist` 目录

---

## 🎨 使用场景

### 场景 1：Obsidian 知识库

将 Chrome 默认下载路径设为 Obsidian Vault 目录：

```
Chrome 设置 → 下载内容 → 位置 → 选择你的 Obsidian Vault
```

点击 **Save as Markdown** 后，论文直接出现在 Obsidian 中，公式自动渲染，立即开始批注。

### 场景 2：Notion 论文管理

1. 下载 Markdown 文件
2. 拖拽到 Notion 页面
3. Notion 自动导入（公式需使用 KaTeX 块）

### 场景 3：批量论文整理

使用 **Save PDF (Renamed)** 批量下载论文，所有文件自动按标题命名，告别 `2312.xxxxx.pdf` 的混乱。

### 场景 4：离线阅读

Markdown 文件体积小、加载快，适合在任何文本编辑器中阅读，无需 PDF 阅读器。

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension (MV3)                   │
├─────────────────────────────────────────────────────────────┤
│  Content Script          Background Worker       Popup UI   │
│  ┌─────────────┐        ┌──────────────┐      ┌─────────┐  │
│  │ 注入按钮     │◄──────►│ 转换调度器    │◄────►│ 设置面板 │  │
│  │ 提取元数据   │        │ 消息路由     │      │ 统计展示 │  │
│  │ HTML→MD 转换 │        │ 下载管理     │      └─────────┘  │
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

### 两层降级策略

```
用户点击 "Save as Markdown"
              │
              ▼
    ┌─────────────────────┐
    │  Tier 1: ar5iv      │ ← 85% 场景，<1秒，完全本地
    │  HTML → Markdown    │
    └─────────────────────┘
              │ 失败（新论文/ar5iv 未收录）
              ▼
    ┌─────────────────────┐
    │  Tier 2: PDF 降级   │ ← 兜底方案，始终有效
    │  标题重命名下载      │
    └─────────────────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| **构建** | Webpack 5 + Babel |
| **转换引擎** | [Turndown](https://github.com/mixmark-io/turndown) + GFM 插件 |
| **DOM 解析** | [linkedom](https://github.com/WebReflection/linkedom)（仅 200KB，vs jsdom 5MB） |
| **数据源** | [ar5iv](https://ar5iv.org) — arXiv 官方 HTML5 渲染服务 |
| **存储** | Chrome Storage API |

---

## 📁 项目结构

```
arxiv-md/
├── src/
│   ├── background/           # Service Worker
│   ├── content/              # Content Script（注入 arXiv 页面）
│   ├── core/
│   │   ├── converter/        # 转换引擎
│   │   │   ├── ar5iv-converter.js
│   │   │   └── index.js      # 主控制器（降级策略）
│   │   └── metadata-extractor.js
│   ├── ui/
│   │   ├── popup/            # 弹出窗口
│   │   └── settings/         # 设置页面
│   ├── utils/                # 工具函数
│   └── config/               # 配置常量
├── dist/                     # 构建输出
└── docs/                     # 文档
```

---

## 🛠️ 开发

```bash
# 开发模式（热重载）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 打包扩展（生成 ZIP）
npm run package
```

---

## ❓ 常见问题

<details>
<summary><strong>Q: 为什么 "Save as Markdown" 按钮有时不显示？</strong></summary>

插件会自动检测 ar5iv 是否已收录该论文。对于刚发布的新论文（通常需要 1-2 天），ar5iv 尚未生成 HTML 版本，此时按钮会自动隐藏。你可以先使用 **Save PDF (Renamed)** 功能。

</details>

<details>
<summary><strong>Q: 转换的 Markdown 公式在 Obsidian 中不显示？</strong></summary>

请确保 Obsidian 已启用 LaTeX 公式渲染。转换后的公式使用标准 LaTeX 语法：
- 行内公式：`$...$`
- 块级公式：`$$...$$`

</details>

<details>
<summary><strong>Q: 图片无法显示？</strong></summary>

图片链接指向 ar5iv CDN，需要联网查看。如需离线使用，可以手动下载图片到本地。

</details>

<details>
<summary><strong>Q: 支持哪些浏览器？</strong></summary>

目前支持：
- ✅ Chrome（推荐）
- ✅ Edge（Chromium 内核）
- 🚧 Firefox（开发中）

</details>

<details>
<summary><strong>Q: 转换失败怎么办？</strong></summary>

1. 检查网络连接
2. 刷新页面重试
3. 使用 **Save PDF (Renamed)** 作为备选
4. 在 [GitHub Issues](https://github.com/Tendo33/arxiv-md/issues) 反馈问题

</details>

---

## 📚 文档

| 文档 | 描述 |
|------|------|
| [快速开始](docs/QUICK_START.md) | 5 分钟上手指南 |
| [架构设计](docs/ARCHITECTURE.md) | 技术架构和设计决策 |
| [开发指南](docs/DEVELOPMENT.md) | 参与贡献的开发流程 |
| [常见问题](docs/FAQ.md) | 50+ 个问题解答 |
| [隐私政策](PRIVACY.md) | 数据使用说明 |

---

## 🙏 致谢

- [ar5iv](https://ar5iv.org) — arXiv 官方 HTML5 渲染服务
- [Turndown](https://github.com/mixmark-io/turndown) — HTML → Markdown 转换库
- [linkedom](https://github.com/WebReflection/linkedom) — 轻量级 DOM 解析
- [arXiv](https://arxiv.org) — 开放获取的预印本论文库

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Tendo33">SimonSun</a>
</p>

<p align="center">
  如果这个项目对你有帮助，请给个 ⭐ Star！
</p>

