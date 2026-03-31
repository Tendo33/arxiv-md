# Architecture

本页描述的是当前仓库中的真实实现，而不是项目历史上曾经存在过的方案。

## 先看结论

这个扩展的核心不是“万能论文转换器”，而是一个围绕 arXiv 摘要页构建的双工作流浏览器扩展：

1. `标准模式`
   ar5iv HTML 拉取与清洗 -> 页面内 Markdown 转换 -> 失败时回退到 PDF
2. `MinerU 模式`
   后台创建任务 -> 轮询 MinerU -> 下载 ZIP -> 在 Popup 中管理任务

## 运行时分层

### 1. Manifest 与入口

- `src/manifest.json`
- `webpack.config.js`

职责：

- 定义 Manifest V3 权限、host permissions、popup、options 页面和 content script 注入范围
- 指定四个构建入口：`background`、`content`、`popup`、`settings`

### 2. 内容脚本层

- `src/content/index.js`

职责：

- 判断当前是否为 arXiv 页面
- 在摘要页的 `Submission history` 下方注入 `Markdown` / `PDF` 按钮
- 提取页面元数据
- 显示进度、提示和错误状态
- 在真实浏览器 DOM 环境中执行 HTML -> Markdown 转换
- 在页面环境中触发文本或 Blob 下载

为什么这层很重要：

- Turndown、DOMParser、页面内下载链接都更适合在内容脚本环境里执行
- 标准模式的 Markdown 真正生成位置就在这里

### 3. 后台 Service Worker

- `src/background/index.js`

职责：

- 接收 `CONVERT_PAPER`、`DOWNLOAD_PDF`、`GET_TASKS` 等消息
- 调度主转换器
- 管理 MinerU 队列、重复任务检测、重试与删除
- 负责桌面通知和安装时打开欢迎设置页

这是控制面，不是最终 Markdown 的生成地点。

### 4. 核心转换层

- `src/core/converter/index.js`
- `src/core/converter/ar5iv-converter.js`
- `src/core/converter/mineru-client.js`

职责拆分：

- `index.js`
  决定走标准模式还是 MinerU 模式
- `ar5iv-converter.js`
  检查 ar5iv 可用性、抓取 HTML、用 `linkedom` 清洗结构，然后把 HTML 发回内容脚本做 Markdown 转换
- `mineru-client.js`
  创建 MinerU 任务、轮询状态、下载 ZIP

### 5. 任务与状态层

- `src/core/task-manager.js`
- `src/utils/storage.js`

职责拆分：

- `task-manager.js`
  只管理 MinerU 任务，存 `chrome.storage.local`
- `storage.js`
  管理同步设置、统计和语言，默认走 `chrome.storage.sync`

### 6. UI 层

- `src/ui/popup/*`
- `src/ui/settings/*`
- `src/config/locales.js`

职责：

- Popup：MinerU 任务中心
- Settings：模式、Token、语言、通知、统计
- `locales.js`：中英文文案

## 当前模块地图

| 模块 | 关键文件 | 作用 |
| --- | --- | --- |
| 页面入口 | `src/content/index.js` | 注入按钮、处理进度、执行 Markdown 转换 |
| 后台协调 | `src/background/index.js` | 接消息、调度转换、管理 MinerU 任务 |
| 标准模式 | `src/core/converter/ar5iv-converter.js` | ar5iv 可用性检查、HTML 获取与清洗 |
| MinerU 集成 | `src/core/converter/mineru-client.js` | 任务创建、轮询、ZIP 下载 |
| 元数据提取 | `src/core/metadata-extractor.js` | 从摘要页或 export API 获取论文信息 |
| 设置与统计 | `src/utils/storage.js` | 读写 `chrome.storage.sync` |
| 本地任务队列 | `src/core/task-manager.js` | 读写 `chrome.storage.local` |
| Popup | `src/ui/popup/popup.js` | 查看、删除、重试、复制结果链接 |
| 设置页 | `src/ui/settings/settings.js` | 模式、Token、语言、通知、统计 |

## 两条主链路

### 标准模式链路

1. 内容脚本在摘要页注入按钮
2. 用户点击 `Markdown`
3. 内容脚本提取元数据并发消息给后台
4. 后台调用 `converter.convert()`
5. `converter` 读取同步设置，判断当前为 `fast`
6. `ar5iv-converter` 先做 `HEAD` 检查，再抓取 ar5iv HTML
7. `linkedom` 在后台清洗页面结构
8. 清洗后的 HTML 发送回内容脚本
9. 内容脚本用 Turndown 和自定义规则生成 Markdown
10. 后台通知内容脚本触发下载
11. 如果 ar5iv 不可用或失败，后台直接回退到 PDF 下载

### MinerU 模式链路

1. 用户在设置页启用 `always`
2. 点击 `Markdown`
3. 后台检查 Token 和重复任务
4. `task-manager` 创建一条本地任务记录
5. `mineru-client` 把 arXiv PDF URL 提交到 MinerU
6. 后台轮询任务状态并持续更新本地任务进度
7. 任务完成后下载 ZIP
8. Popup 通过 `GET_TASKS` 展示任务状态并提供二次操作

## 为什么 HTML -> Markdown 不放在后台里做完

这里有两个阶段：

1. 后台先用 `linkedom` 做 HTML 清洗
2. 内容脚本再在真实浏览器 DOM 环境中执行 Turndown 转换

这样做的原因是：

- 内容脚本拿得到更自然的浏览器 DOM API
- 下载文本文件也更适合在页面环境里触发
- 后台负责网络编排和状态管理，内容脚本负责最终渲染转换

## 存储模型

### `chrome.storage.sync`

由 `src/utils/storage.js` 管理，主要包括：

- 转换模式
- MinerU Token
- 语言
- 是否显示通知
- 是否显示自动转换提示
- 是否包含 Markdown 元数据
- 使用统计

### `chrome.storage.local`

由 `src/core/task-manager.js` 管理，主要包括：

- MinerU 任务列表
- 任务状态
- 任务进度
- 结果 ZIP 链接
- 下载记录 ID

## 网络边界

当前代码会访问这些外部地址：

- `arxiv.org`
- `export.arxiv.org`
- `ar5iv.labs.arxiv.org`
- `mineru.net`
- `cdn-mineru.openxlab.org.cn`

其中最关键的边界差异是：

- 标准模式：从 ar5iv 拉 HTML，再本地转 Markdown
- MinerU 模式：把 arXiv PDF URL 和 Token 发给 MinerU

## 最容易误读的几点

### 1. Popup 不是全量任务历史

它只展示 MinerU 任务，不展示标准模式的成功记录。

### 2. 标准模式不会自动切到 MinerU

标准模式的回退目标只有 PDF。

### 3. 复杂表格不是 GFM 表格优先

当前实现会优先保留 HTML 表格，以避免复杂结构损坏。

## 扩展点建议

如果后续要继续迭代，最安全的切入点通常有这些：

- 在 `src/core/converter/index.js` 增加新的转换分支
- 在 `src/content/index.js` 增加新的预处理或 Turndown 规则
- 在 `src/ui/popup/` 扩展 MinerU 任务操作
- 在 `src/utils/storage.js` 和 `src/ui/settings/` 增加新的设置项

## 深入阅读入口

- [docs/DEVELOPMENT.md](./DEVELOPMENT.md)
- [docs/mentor/README.md](./mentor/README.md)
- [docs/mentor/02-request-lifecycle.md](./mentor/02-request-lifecycle.md)
