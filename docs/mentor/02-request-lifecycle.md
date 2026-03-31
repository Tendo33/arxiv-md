# 02 Request Lifecycle

这页专门追一条请求从点击到结束的全路径。

## 路径一：标准模式 Markdown 导出

### Step 1：用户点击按钮

入口：

- `src/content/index.js -> handleConversionTrigger('markdown')`

这里会：

- 禁用按钮
- 显示进度 UI
- 从页面提取元数据
- 给后台发送 `CONVERT_PAPER`

### Step 2：后台接收消息

入口：

- `src/background/index.js -> handleConvertPaper()`

这里会：

- 构造进度回调
- 调用 `converter.convert(...)`
- 把后台阶段进度再发回当前 Tab

### Step 3：主转换器决定路线

入口：

- `src/core/converter/index.js -> convert()`

这里读取：

- 转换模式
- MinerU Token
- 是否包含 metadata

在标准模式下，会进入：

- `_convertWithTieredStrategy()`

### Step 4：ar5iv 分支执行

入口：

- `src/core/converter/ar5iv-converter.js -> convert()`

内部顺序：

1. `checkAvailability()` 做 ar5iv HEAD 检查
2. `fetchHtml()` 拉取 HTML
3. `cleanHtml()` 用 `linkedom` 清洗主内容
4. `toMarkdown()` 把 HTML 发回内容脚本

### Step 5：内容脚本生成 Markdown

入口：

- `src/content/index.js -> handleHtmlToMarkdown()`

这里会：

- 预处理数学元素、列表、ar5iv 结构和表格
- 配置 Turndown 规则
- 生成 Markdown
- 做一轮后处理
- 把结果发回后台

### Step 6：触发下载

入口：

- `src/core/converter/index.js -> _downloadViaContentScript()`
- `src/content/index.js -> handleFileDownload()`

这里不是直接走 `chrome.downloads`，而是让内容脚本创建 `<a download>` 来发起下载。

### Step 7：失败时回退

如果 ar5iv 检查或转换失败，主转换器会进入：

- `src/core/converter/index.js -> _fallbackToPdf()`

最终使用 `chrome.downloads.download()` 下载 PDF。

## 路径二：MinerU 后台任务

### Step 1：用户点击 Markdown

仍然从：

- `src/content/index.js -> handleConversionTrigger('markdown')`

开始，但此时设置里的模式是 `always`。

### Step 2：后台切到 MinerU

入口：

- `src/core/converter/index.js -> _convertWithMinerU()`

这里会：

- 检查 Token
- 检查是否已有同 arXiv ID 的任务
- 创建任务或返回重复任务提示

### Step 3：任务入队

入口：

- `src/core/task-manager.js -> addTask()`

创建的任务会被持久化到 `chrome.storage.local`。

### Step 4：后台异步处理

入口：

- `src/background/index.js -> processMinerUTaskInBackground()`

这里会：

- 把任务标记为 `processing`
- 调用 `mineru-client.convert()`
- 轮询进度并回写任务状态
- 完成后记录 ZIP URL 和下载 ID

### Step 5：Popup 展示

入口：

- `src/ui/popup/popup.js -> loadTasks()`

Popup 的数据来源不是后台内存，而是后台通过 `GET_TASKS` 暴露的任务列表和统计。

## 哪些状态在哪一层变化

| 状态 | 更新位置 | 消费位置 |
| --- | --- | --- |
| 页面进度条 | 内容脚本 | 当前论文页 |
| 转换模式 | 设置页 / `storage.sync` | 内容脚本、后台 |
| 统计数据 | 后台 / `storage.sync` | 设置页 |
| MinerU 任务状态 | 后台 / `storage.local` | Popup |
| 桌面通知 | 后台 | 操作系统通知中心 |

## Trace 练习

自己做一次完整追踪：

1. 选择标准模式
2. 点击 `Markdown`
3. 记录控制台里最先出现的 5 条日志
4. 找出日志分别来自哪个文件
5. 再切到 MinerU 模式重复一遍

只要你能把两条路径的第一个分叉点找出来，后续维护效率会高很多。
