# 01 Quickstart Path

## 20 分钟上手目标

读完这页，你应该能在本地完成一次真实验证，并知道改动一个设置项会穿过哪些文件。

## 第 1 步：先把扩展跑起来

```bash
npm install
npm run dev
```

然后在浏览器里加载 `dist/`。

## 第 2 步：用一个老论文跑标准模式

选择一篇大概率已有 ar5iv HTML 的论文，例如比较老的热门论文。

操作：

1. 打开摘要页
2. 点击 `Markdown`
3. 观察页面进度条
4. 检查下载文件

这一步想搞清楚三件事：

- 按钮是谁注入的
- 进度是谁更新的
- 下载是谁触发的

对应代码入口：

- `src/content/index.js -> injectConvertButton()`
- `src/content/index.js -> updateProgressUI()`
- `src/core/converter/index.js -> _downloadViaContentScript()`

## 第 3 步：看一次模式读取

去设置页切换成 `MinerU Mode`，再回到论文页刷新。

你会发现 Markdown 按钮副标题从 `ar5iv` 变成 `MinerU`。

关键代码：

- `src/ui/settings/settings.js -> saveSettings()`
- `src/utils/storage.js -> setConversionMode()`
- `src/content/index.js -> injectConvertButton()`

这能帮你建立“设置页写状态，页面层读状态”的最基本心智模型。

## 第 4 步：看一次 Popup 读取

如果你有 Token，就提一次 MinerU 任务，然后打开 Popup。

观察：

- Popup 会显示任务卡片
- 状态和进度来自后台更新的 `chrome.storage.local`

关键代码：

- `src/background/index.js -> processMinerUTaskInBackground()`
- `src/core/task-manager.js -> updateTask()`
- `src/ui/popup/popup.js -> loadTasks()`

## 第 5 步：做一个最小修改练习

练习建议：改一个设置说明文案，比如自动转换描述。

你需要碰到的文件：

- `src/config/locales.js`
- 如果影响行为，再看 `src/ui/settings/settings.html`

这样做的目的不是改产品，而是熟悉这个仓库里“文案 -> 页面 -> 存储 -> 行为”的关系。

## 新人最容易踩的坑

### 1. 误以为 Popup 管理所有转换

不是。Popup 只管理 MinerU 任务。

### 2. 误以为标准模式会自动走 MinerU

不会。标准模式只会走 `ar5iv -> PDF fallback`。

### 3. 误以为后台直接把 Markdown 转完

后台只负责获取、清洗和调度；真正的 HTML -> Markdown 转换回到了内容脚本。

## 动手练习

完成下面这个小任务：

1. 在设置页切换语言
2. 刷新论文页
3. 找出按钮文案是如何更新的
4. 找出 Popup 文案是如何更新的

如果你能回答这两个问题，就已经掌握了这套仓库最常见的 UI 变更路径。
