# 03 Advanced Features

这页只讲最值得深挖的四个点。

## 1. ar5iv 清洗和浏览器内 Markdown 转换是分阶段完成的

很多人第一次看会误以为：

- 后台拿到 HTML
- 后台直接转成 Markdown
- 后台直接下载

实际不是。

当前分工是：

- 后台用 `linkedom` 做结构清洗
- 内容脚本用真实浏览器 DOM 环境做 Turndown 转换
- 下载也优先交回内容脚本

为什么值得这样拆：

- 浏览器 DOM 环境更适合 Turndown 和页面下载
- 后台仍然能处理网络编排和进度状态
- `linkedom` 足够轻，适合在 worker 里做预清洗

看这些入口最直观：

- `src/core/converter/ar5iv-converter.js -> cleanHtml()`
- `src/core/converter/ar5iv-converter.js -> toMarkdown()`
- `src/content/index.js -> handleHtmlToMarkdown()`

调试提示：

- 如果拿到的 HTML 很怪，先看 `cleanHtml()`
- 如果 Markdown 结构坏了，优先查 `handleHtmlToMarkdown()`

## 2. 表格不是“尽量转 GFM”，而是“必要时保留 HTML”

旧直觉容易觉得 Markdown 表格更“纯”，但当前实现为了减少复杂表格损坏，专门加了保留 HTML table 的规则。

关键位置：

- `src/content/index.js -> keepHtmlTables`

这意味着：

- README、FAQ、产品文案都不该宣称“所有表格都转成了纯 Markdown 表格”
- 如果后续想增加“导出为 GFM 表格”的选项，最好做成显式开关，而不是直接替换默认行为

调试提示：

- 出现 colspan/rowspan 丢失时，先确认是不是某段预处理提前破坏了 table 结构

## 3. MinerU 的真实复杂度在任务生命周期，而不是 API 调用本身

真正难的不是一次 `fetch`，而是这些状态问题：

- 重复任务检查
- 删除后阻断后续下载
- 重试时重置状态
- Popup 与后台状态保持一致

核心文件：

- `src/background/index.js`
- `src/core/task-manager.js`
- `src/core/converter/mineru-client.js`

特别要注意：

- `deletedTaskIds` 是为了防止任务删除后仍继续触发下载或通知
- Popup 不是主动订阅后台内存，而是依赖存储变化和重新拉取

调试提示：

- 任务状态怪异时，优先打印 `chrome.storage.local` 中的 `mineruTasks`

## 4. 存储边界直接影响产品说明和隐私说明

这个仓库很容易把“本地处理”说得过满，但实际实现是分层的：

- 设置和统计在 `chrome.storage.sync`
- 任务在 `chrome.storage.local`
- MinerU Token 会进入同步存储
- MinerU 模式会把 arXiv PDF URL 发给第三方服务

这直接影响两类文档：

- `README*`
- `PRIVACY.md`

如果以后你改了以下内容，文档必须跟着改：

- Token 的存储位置
- 任务的存储位置
- 第三方服务列表
- host permissions

## 动手练习

选一个专题深挖：

1. 在 `handleHtmlToMarkdown()` 里追一遍公式恢复流程
2. 在 `processMinerUTaskInBackground()` 里追一遍任务状态流转
3. 在 `storage.js` 和 `task-manager.js` 里对比 sync/local 的职责边界

目标不是记住所有实现细节，而是形成“问题该去哪一层找”的感觉。
