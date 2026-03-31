# arXiv to Markdown

直接在 arXiv 摘要页，把论文保存成 Markdown、标题命名的 PDF，或者提交到 MinerU 后台解析。

[Chrome Web Store](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd) · [English README](./README.md) · [FAQ](./docs/FAQ.md) · [架构文档](./docs/ARCHITECTURE.md) · [开发文档](./docs/DEVELOPMENT.md) · [隐私说明](./PRIVACY.md) · [贡献指南](./CONTRIBUTING.md) · [更新日志](./CHANGELOG.md)

## 项目概览

`arXiv to Markdown` 是一个基于 Manifest V3 的 Chrome/Edge 扩展。

它会在 arXiv 摘要页的 `Submission history` 下方注入两个按钮：

- `Markdown`：按照当前默认模式执行转换
- `PDF`：直接下载原始 PDF，并使用基于标题的文件名

当前代码里的真实工作流一共只有两条：

1. `标准模式`
   `ar5iv HTML -> 页面内本地 Markdown 转换 -> 失败时回退到 PDF`
2. `MinerU 模式`
   `提交 arXiv PDF URL 到 MinerU -> 后台轮询任务 -> 完成后下载 ZIP 结果包`

## 当前版本能做什么

- 在 `https://arxiv.org/abs/*` 页面注入转换按钮
- 从摘要页提取论文元数据，必要时回退到 arXiv export API
- 在浏览器内容脚本里用 Turndown 把 ar5iv HTML 转成 Markdown
- 尽量保留 LaTeX 公式
- 为了保住合并单元格，复杂表格会保留为 HTML 表格
- 图片保留为 ar5iv 远程链接，不会本地打包
- 可选为 Markdown 添加 YAML frontmatter
- 在 Popup 中管理 MinerU 后台任务
- Popup、设置页和页面按钮支持中英文切换

## 安装方式

### 方式一：从 Chrome Web Store 安装

直接前往 [Chrome Web Store](https://chromewebstore.google.com/detail/arxiv-to-markdown/pphdggfbjddgdljndgdablkhbdpbfnbd) 安装。

### 方式二：本地开发版

```bash
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md
npm install
npm run build
```

然后打开 `chrome://extensions`，启用 `Developer mode`，点击 `Load unpacked`，选择 `dist/`。

## 如何使用

1. 打开任意 arXiv 摘要页，例如 `https://arxiv.org/abs/1706.03762`。
2. 在 `Submission history` 下方找到 `Markdown` 和 `PDF` 按钮。
3. 点击 `Markdown`，按照设置页中选定的默认模式执行转换。
4. 点击 `PDF`，直接下载标题命名的原始论文 PDF。
5. 如果你在用 MinerU，可以打开 Popup 查看任务进度、重试、删除或再次下载结果。

## 输出行为

### Markdown 导出

- 来源：ar5iv HTML
- 转换位置：页面内容脚本
- 元数据：可选 YAML frontmatter，包含 `title`、`arxiv_id`、`source`、`authors`、`year`
- 表格：复杂表格保留为 HTML
- 图片：保留为远程链接，不做本地资源打包

### PDF 导出

- 由页面上的 `PDF` 按钮直接触发
- 在页面上下文中下载原始 arXiv PDF
- 使用基于标题的文件名

### MinerU 导出

- 仅在启用 `MinerU 模式` 且已配置 Token 时可用
- 以后台任务方式执行
- 下载结果是 ZIP 包，不是 `.md`
- 任务会出现在 Popup 中

## Popup 与设置页

### Popup

Popup 是 `MinerU 任务中心`，不是所有转换的历史记录。

它会显示：

- 等待中、处理中、已完成、失败的 MinerU 任务
- 后台解析进度
- 重试、删除、复制结果链接、重新下载 ZIP 的操作入口

### 设置页

设置页支持：

- 切换 `标准模式` 和 `MinerU 模式`
- 保存并测试 MinerU API Token
- 启用或关闭桌面通知
- 进入论文页时弹出自动转换提示
- 打开或关闭 Markdown 元数据
- 切换中英文界面
- 重置使用统计

## 文档索引

- [docs/FAQ.md](./docs/FAQ.md)：常见问题和排错说明
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)：当前运行架构和模块分工
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)：本地开发、调试与发布流程
- [docs/mentor/README.md](./docs/mentor/README.md)：面向维护者的源码导读包

## 开发命令

```bash
npm run dev
npm run build
npm run lint
npm test
npm run package
```

Webpack 会输出到 `dist/`，`npm run package` 会生成 `build/arxiv-md-v<version>.zip`。

## 当前限制

- 按钮注入只面向 arXiv 摘要页
- 标准模式不会自动回退到 MinerU，只会回退到 PDF
- Popup 只管理 MinerU 任务
- Markdown 中的图片仍然依赖远程链接
- MinerU 是可选外部服务

## 许可证

MIT。
