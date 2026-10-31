# FAQ

本页根据当前代码实现整理，默认以中文说明为主。英文读者建议先看 [README.md](../README.md)。

## 基础使用

### 1. 按钮会出现在什么页面？

按钮会注入到 `https://arxiv.org/abs/*` 这类摘要页，并插在 `Submission history` 下方。项目虽然也给 `pdf/*` 页面加载了 content script，但当前按钮注入逻辑只在摘要页执行。

### 2. `Markdown` 按钮到底会做什么？

这取决于设置页里的默认模式：

- `标准模式`：先尝试官方 arXiv HTML，再尝试 ar5iv，两者都不可用或转换失败时回退到 PDF
- `PDF 解析模式`：把 PDF 交给设置页里选中的解析后端，后台异步处理。默认后端是
  `PaddleOCR`（星河，免费额度）：后台先下载 PDF 再以 multipart 上传，上限 50 MB；
  选 `MinerU` 时只提交 arXiv PDF 链接，由对方拉取

按钮副标题会显示当前模式：标准模式是 `HTML`，PDF 解析模式是 `PDF 解析 · <所选后端>`。

### 3. `PDF` 按钮和 Markdown 失败后的 PDF 兜底是一回事吗？

不完全一样。

- 页面上的 `PDF` 按钮：直接在内容脚本里抓取原始 PDF 并下载
- 标准模式里的 PDF 兜底：由后台逻辑在官方 HTML 和 ar5iv 都失败后触发

两者最终拿到的都是原始 arXiv PDF，但触发路径不同。

## 转换效果

### 4. Markdown 会保留哪些内容？

当前实现重点保留这些内容：

- LaTeX 公式
- 章节标题
- 引用标记
- 图注、定理、证明等结构块
- 复杂表格的 HTML 结构

其中复杂表格会保留为 HTML 表格，而不是强行转成纯 Markdown 表格，这样能减少合并单元格丢失的问题。

### 5. 图片会一起下载到本地吗？

不会。图片保留为远程链接，地址按实际抓到的 HTML 页面解析。官方 HTML 的图在 `arxiv.org`，回退到 ar5iv 时图在 `ar5iv.labs.arxiv.org`。阅读图片时仍然需要联网。

### 6. Markdown 文件头里会包含元数据吗？

默认会。设置页里有 `Include metadata` 开关。开启后，导出的 Markdown 顶部会带 YAML frontmatter，包含标题、arXiv ID、来源、作者、年份等字段。

## 模式与任务

### 7. 标准模式是不是“HTML -> PDF 解析后端 -> PDF”的自动降级？

不是。当前实现里：

- 标准模式：`官方 arXiv HTML -> ar5iv -> PDF`
- PDF 解析模式：单独的手动默认模式，需要所选后端的 Key

也就是说，标准模式不会在 HTML 失败后自动切到 PDF 解析后端。

### 8. 为什么我做了标准模式转换，Popup 里却没有记录？

因为 Popup 只显示 PDF 解析后台任务（不分后端），不显示标准模式的 Markdown 成功记录，也不显示普通 PDF 下载历史。

### 9. PDF 解析任务的结果是什么格式？

有图片时是 ZIP 包（Markdown + 抽出的图片），没有图片时直接给 `.md`。任务完成后：

- 后台会触发下载
- Popup 中会保留任务卡片
- 你可以再次点击下载，或者复制结果链接

### 10. 为什么会提示“已有重复任务”？

PDF 解析任务会按 arXiv ID 查重。如果同一篇论文已有任务，页面会弹出确认框，让你决定是否强制再创建一个新任务。

## 设置与存储

### 11. 设置页里有哪些真正生效的选项？

当前代码实际使用的主要选项有：

- 转换模式（标准模式 / PDF 解析模式）
- PDF 解析后端（PaddleOCR / MinerU）
- 所选后端的 Key
- 是否显示桌面通知
- 是否在页面加载时显示自动转换提示
- 是否在 Markdown 中包含元数据
- 界面语言
- 是否显示页面上的 PDF 浮动按钮
- 标准模式无 HTML 时是否回退保存 PDF

### 12. 自动转换会直接开始跑任务吗？

不会。它的真实行为是“页面加载后显示一个自动转换提示框”，由你点击 `Start` 后才正式开始。

### 13. 数据存在哪里？

分成两类：

- `chrome.storage.sync`：设置、语言、统计、所选 PDF 解析后端
- `chrome.storage.local`：各后端的 Key（`providerKeys`）、任务队列、任务状态、结果链接

**Key 只存 `local`，不会进 `sync`**：旧版本曾把 MinerU Token 写进 `sync`，升级时会自动迁移到 `local` 并从 `sync` 删除。设置和统计在 `sync` 里，如果登录了浏览器同步账号，会跟随账号同步，而不是只留在单机。

## 故障排查

### 14. 为什么提示暂无 HTML 版本？

这表示官方 arXiv HTML 和 ar5iv 都没有可转换的论文正文，或者请求被重定向回摘要页。标准模式下这时会提示你仍可使用 PDF 兜底。有官方 HTML 的新论文不会因为 ar5iv 尚未收录而出现这条提示。

### 15. 为什么会报“扩展已更新或重载，请刷新页面后重试”？

这是内容脚本和后台 service worker 之间的连接失效了，常见于你刚重新构建并重载扩展。刷新当前 arXiv 页面后再试即可。

### 16. 后端 Key 测试失败怎么办？

先确认三件事：

- Key 已粘贴到设置页，且和**当前选中的后端**对应（换后端要填对应那一个的 Key）
- 网络能访问所选后端的域名：`https://paddleocr.aistudio-app.com`（PaddleOCR/星河）或
  `https://mineru.net`（MinerU）
- Key 没有过期或失效

设置页的“测试连接”本质上是拿这个 Key 去请求所选后端的接口，所以网络或鉴权问题都会直接反映在这里。
PaddleOCR 的 Key 在 `https://aistudio.baidu.com/account/accessToken` 获取，
MinerU 的在 `https://mineru.net/apiManage/token`。

### 17. PDF 下载失败时先查什么？

优先排查：

- 浏览器下载权限或下载目录限制
- 当前页面是否真的能访问对应的 arXiv PDF
- 是否有浏览器扩展或策略拦截下载

### 18. 哪里可以看更详细的实现说明？

从这几份文档开始最有效：

- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/DEVELOPMENT.md](./DEVELOPMENT.md)
- [docs/mentor/README.md](./mentor/README.md)
