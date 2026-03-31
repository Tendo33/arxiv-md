# 00 Codebase Map

## 先建立整体图

这个仓库可以按“页面入口、后台协调、核心转换、任务状态、UI 展示”五层来读。

```text
arXiv Abstract Page
  -> content script
  -> background service worker
  -> converter / task manager
  -> popup + settings UI
  -> storage + downloads + notifications
```

## 顶层目录

```text
src/
├── background/
├── config/
├── content/
├── core/
├── ui/
└── utils/

docs/
├── ARCHITECTURE.md
├── DEVELOPMENT.md
├── FAQ.md
└── mentor/
```

## 每一层先读什么

### 1. 入口与边界

先读：

- `src/manifest.json`
- `webpack.config.js`

你会知道：

- 哪些脚本会被打包
- content script 注入到哪些页面
- popup 和 settings 页面如何挂载
- 扩展申请了哪些权限和 host permissions

### 2. 页面层

再读：

- `src/content/index.js`

这里承担了三件大事：

1. 页面按钮注入
2. 页面元数据提取和进度展示
3. HTML -> Markdown 的最终转换

第一次读的时候不要试图一口气看完整个文件。先只追这几个函数：

- `init()`
- `injectConvertButton()`
- `handleConversionTrigger()`
- `handleHtmlToMarkdown()`

### 3. 后台层

接着读：

- `src/background/index.js`

优先关注：

- `chrome.runtime.onMessage.addListener(...)`
- `handleConvertPaper()`
- `handleStartMinerUTask()`
- `processMinerUTaskInBackground()`

这里是整个扩展的调度中心。

### 4. 核心逻辑层

然后读：

- `src/core/converter/index.js`
- `src/core/converter/ar5iv-converter.js`
- `src/core/converter/mineru-client.js`
- `src/core/metadata-extractor.js`
- `src/core/task-manager.js`

读这层时建议按“同步路径”和“异步路径”分开理解：

- 同步路径：标准模式的 ar5iv -> Markdown / PDF
- 异步路径：MinerU 任务提交 -> 轮询 -> ZIP 下载

### 5. UI 与状态层

最后读：

- `src/ui/popup/popup.js`
- `src/ui/settings/settings.js`
- `src/utils/storage.js`
- `src/config/locales.js`

你会看到：

- Popup 为什么只能显示 MinerU 任务
- 设置项如何落到 `chrome.storage.sync`
- 统计、语言和通知开关分别怎么影响行为

## 推荐阅读顺序

### 10 分钟版本

1. `src/manifest.json`
2. `src/content/index.js`
3. `src/background/index.js`
4. `src/core/converter/index.js`

### 30 分钟版本

1. 上面的 4 个文件
2. `src/core/converter/ar5iv-converter.js`
3. `src/core/converter/mineru-client.js`
4. `src/core/task-manager.js`
5. `src/utils/storage.js`
6. `src/ui/popup/popup.js`
7. `src/ui/settings/settings.js`

## 最值得先记住的事实

- 标准模式不会自动切到 MinerU
- Popup 是 MinerU 任务中心，不是全量历史
- Markdown 生成最终发生在内容脚本，不是在后台直接落盘
- 设置和统计走 `sync`，任务状态走 `local`

## 动手练习

打开一个 arXiv 摘要页，点击一次 `Markdown`，然后只靠日志和代码回答：

- 这次有没有先检查 ar5iv 可用性？
- 当前模式是在哪一层被读取的？
- 真正发起下载的是后台还是内容脚本？
