# 04 Learning Plan

这是一份 7 天维护者入门计划，适合第一次正式接手这个仓库时使用。

## Day 1：建立全局认知

阅读：

- `src/manifest.json`
- `docs/ARCHITECTURE.md`
- `docs/mentor/00-codebase-map.md`

完成标准：

- 说清楚扩展有哪几个运行面
- 说清楚标准模式和 MinerU 模式的区别

## Day 2：跑通页面层

阅读：

- `src/content/index.js`

练习：

- 找到按钮注入入口
- 找到进度 UI 更新入口
- 找到 HTML -> Markdown 转换入口

完成标准：

- 能解释用户点击 `Markdown` 后页面层做了什么

## Day 3：跑通后台层

阅读：

- `src/background/index.js`
- `src/core/converter/index.js`

练习：

- 追一遍 `CONVERT_PAPER`
- 追一遍 `START_MINERU_TASK`

完成标准：

- 能解释消息是怎么从内容脚本进入后台的

## Day 4：理解核心转换

阅读：

- `src/core/converter/ar5iv-converter.js`
- `src/core/converter/mineru-client.js`
- `src/core/metadata-extractor.js`

练习：

- 找出 ar5iv availability check 的判断依据
- 找出 MinerU 任务轮询的退出条件

完成标准：

- 能说清楚 Markdown 生成和 ZIP 下载分别在哪发生

## Day 5：理解状态与 UI

阅读：

- `src/core/task-manager.js`
- `src/utils/storage.js`
- `src/ui/popup/popup.js`
- `src/ui/settings/settings.js`

练习：

- 对比 `chrome.storage.sync` 和 `chrome.storage.local`
- 在 Popup 里删一个任务，再看后台会发生什么

完成标准：

- 能解释为什么 Popup 只显示 MinerU 任务

## Day 6：做一个小改动

任务建议：

- 修改一条设置页文案
- 修改一条 FAQ
- 调整一个轻量 UI 行为

要求：

- 改代码
- 跑手测
- 同步相关文档

完成标准：

- 你知道一次“看起来很小的改动”会触发哪些文件联动

## Day 7：做一次完整验证

验证清单：

1. 标准模式成功路径
2. 标准模式 PDF 回退路径
3. MinerU 提交与 Popup 查看
4. 设置页保存与语言切换
5. 文档是否仍准确

## 完成定义

当你能独立完成以下事情时，就算真正接手成功：

- 新增一个设置项
- 修一个 MinerU 状态流问题
- 修一个 Markdown 转换规则
- 同步修改 README / FAQ / Privacy 文档
