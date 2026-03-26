<p align="center">
  <img src="./docs/icons/arxiv_md.png" alt="arXiv to Markdown" width="120">
</p>

<h1 align="center">arXiv to Markdown</h1>

<p align="center">
  直接在 arXiv 论文页，把论文保存成干净的 Markdown，或者命名清晰的 PDF。
</p>

<p align="center">
  适合用 Obsidian、Notion、VS Code，或者单纯想把论文整理得更顺手的人。
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd"><img src="https://img.shields.io/badge/%E5%AE%89%E8%A3%85-Chrome%20Web%20Store-4285F4?logo=googlechrome&logoColor=white" alt="安装 Chrome 扩展"></a>
  <a href="./README.md"><img src="https://img.shields.io/badge/Docs-English-0F172A" alt="English documentation"></a>
  <a href="./docs/FAQ.md"><img src="https://img.shields.io/badge/%E6%96%87%E6%A1%A3-FAQ-16A34A" alt="FAQ"></a>
  <a href="./CHANGELOG.md"><img src="https://img.shields.io/badge/%E6%96%87%E6%A1%A3-Changelog-F59E0B" alt="Changelog"></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/%E6%96%87%E6%A1%A3-Contributing-7C3AED" alt="Contributing"></a>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-00C853" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Version-1.1.6-2563EB" alt="Version 1.1.6">
  <a href="https://github.com/Tendo33/arxiv-md/releases"><img src="https://img.shields.io/badge/Releases-GitHub-black" alt="GitHub Releases"></a>
</p>

<p align="center">
  <a href="#项目简介">项目简介</a> |
  <a href="#截图预留">截图预留</a> |
  <a href="#为什么会做这个工具">为什么会做这个工具</a> |
  <a href="#功能概览">功能概览</a> |
  <a href="#工作方式">工作方式</a> |
  <a href="#快速开始">快速开始</a> |
  <a href="#使用方法">使用方法</a> |
  <a href="#设置说明">设置说明</a> |
  <a href="#常见问题">常见问题</a> |
  <a href="#开发说明">开发说明</a>
</p>

---

## 项目简介

`arXiv to Markdown` 是一个 Chrome 扩展，会在 arXiv 论文页面上直接加入保存按钮。

和下载一堆 `2312.12345.pdf` 这种文件不同，它更适合真实的读论文流程：

- 需要进笔记库时，保存成 Markdown
- 只想留原文时，保存成命名更清楚的 PDF
- 遇到某条转换链路不可用时，也尽量给你一个能落地的结果

这个项目解决的不是“能不能下载论文”，而是“下载之后是不是还方便整理、搜索、引用和复用”。

## 截图预留

你提到后面会自己补截图，所以这里先把版位留出来。

### 论文页主界面

![论文页截图](assets/paper-page.png)

### Popup / 任务中心

<img src="assets/popup.png" width="200">

## 为什么会做这个工具

如果你经常看论文，这几个问题应该不陌生：

- PDF 文件名越来越多，但回头找的时候根本记不住
- 手动复制内容进笔记软件很慢，还容易乱
- 公式、表格和结构在普通转换里经常丢得厉害
- 论文是下到了本地，但后续整理和检索还是麻烦

这个扩展想做的事情很直接：在论文页点一下，拿到一个你之后真的愿意继续使用的文件。

## 功能概览

### 面向真实使用场景

- 直接保存成适合 Obsidian、Notion、VS Code 或本地知识库的 Markdown
- 也可以保存成命名更清楚的 PDF
- 可选附带元数据，方便后续整理和检索

### 默认优先速度

- 优先走 [ar5iv](https://ar5iv.org) 的 HTML 结果做转换
- Markdown 转换过程尽量在浏览器本地完成
- 对大部分常见论文，比手动整理省事很多

### 三层兜底策略

- `Tier 1`: ar5iv，速度快，公式保留更友好
- `Tier 2`: MinerU，适合更复杂的版式和 PDF 解析
- `Tier 3`: 直接下载 PDF，并整理好文件名

### 更适合整理论文

- Markdown 中尽量保留 LaTeX 公式
- 结构保留效果通常好于纯文本提取
- 很适合配合笔记库收件箱、文献整理目录等工作流

### 自带任务管理

- 在弹窗里查看转换进度
- 区分已完成、失败和处理中任务
- MinerU 任务失败后可重试，不用完全从头来

## 工作方式

这个扩展不是只押注在一条转换链路上。

1. 你打开 arXiv 论文页后，扩展会先判断当前能走哪条转换路径。
2. 如果 ar5iv 已经提供了对应的 HTML 版本，就在本地把它转成 Markdown。
3. 如果你启用了 MinerU，或者论文版式更复杂，也可以走 MinerU 的 PDF 解析流程。
4. 如果 Markdown 路线不可用，至少还可以把原始 PDF 以更清楚的名字保存下来。

这套兜底逻辑是它在日常使用里比较稳的一点。

## 快速开始

### 方式一：从 Chrome Web Store 安装

[安装 arXiv to Markdown](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd)

### 方式二：本地安装开发版

```bash
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md
npm install
npm run build
```

然后：

1. 打开 `chrome://extensions/`
2. 打开 `Developer mode`
3. 点击 `Load unpacked`
4. 选择 `dist` 目录

## 使用方法

1. 打开任意 arXiv 论文页，例如 [1706.03762](https://arxiv.org/abs/1706.03762)。
2. 在页面中找到扩展注入的操作按钮。
3. 点击 `Markdown` 保存 Markdown，或者点击 `PDF` 保存 PDF。
4. 如果想查看任务状态、重试或下载结果，可以打开扩展弹窗。

如果你用 Obsidian，把 Chrome 下载目录直接设成 Vault 的收件箱，整体体验会顺很多。

## 设置说明

设置页尽量保持简单，主要是这些内容：

### 转换模式

- `Standard Mode`：优先使用 ar5iv，需要时再兜底
- `MinerU Mode`：走 MinerU 解析，需要配置 token

### 可选控制项

- 是否在 Markdown 中包含元数据
- 是否启用桌面通知
- 是否在论文页自动弹出转换提示
- MinerU token 的填写与连接测试

## 常见问题

### 现在只支持 arXiv 吗？

是的，当前版本主要面向 `arxiv.org` 的论文页面。

### 都是本地处理吗？

基于 ar5iv 的 Markdown 转换主要在浏览器本地完成。MinerU 模式不同，它依赖外部解析服务。

### 为什么有时看不到 Markdown 按钮？

通常是因为 ar5iv 还没有处理那篇论文，尤其是新论文更常见。这种情况下，PDF 兜底依然可用。

### 公式和表格表现怎么样？

这正是这个项目的重点之一。基于 ar5iv 的路线，对公式保留会比普通复制粘贴稳定得多；复杂版式则可以交给 MinerU。

### 更详细的排错说明在哪看？

可以继续看 [FAQ](./docs/FAQ.md) 和 [PRIVACY.md](./PRIVACY.md)。

## 开发说明

### 常用命令

- `npm run dev`：启动 webpack watch
- `npm run build`：生成生产构建
- `npm run lint`：运行 ESLint
- `npm test`：运行 Jest
- `npm run package`：构建并生成发布 zip

### 项目结构

```text
src/
|-- background/   # service worker
|-- content/      # 注入 arXiv 页面的 content script
|-- core/         # 转换与任务逻辑
|-- ui/           # popup 和 settings 页面
|-- utils/        # 工具函数、日志、存储
`-- config/       # 常量与多语言配置
```

### 发布

打 `vX.Y.Z` 标签后，会触发 GitHub Release 工作流，并在 `build/` 中生成扩展压缩包。

## 参与贡献

欢迎提 Issue，也欢迎提 Pull Request。

- 贡献说明：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 更新记录：[CHANGELOG.md](./CHANGELOG.md)
- 问题反馈：[GitHub Issues](https://github.com/Tendo33/arxiv-md/issues)

## 许可证

MIT。项目维护者为 [SimonSun](https://github.com/Tendo33)。
