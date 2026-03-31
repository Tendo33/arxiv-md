# Development Guide

本页面向当前仓库的维护者和贡献者，重点是“怎么在本地跑起来、怎么验证、哪里排错最快”。

## 环境要求

- Node.js 16+
- npm 8+
- Chrome 或 Edge

## 本地启动

```bash
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md
npm install
npm run dev
```

首次加载扩展：

1. 打开 `chrome://extensions/`
2. 开启 `Developer mode`
3. 点击 `Load unpacked`
4. 选择仓库里的 `dist/`

`npm run dev` 会持续监听源码变化并重建 `dist/`。

## 常用命令

```bash
npm run dev
npm run build
npm run lint
npm test
npm run package
```

说明：

- `build`：单次构建生产包
- `dev`：watch 模式
- `lint`：检查 `src/**/*.js`
- `test`：运行 Jest，当前仓库允许没有测试文件
- `package`：先构建，再生成 `build/arxiv-md-v<version>.zip`

## 推荐开发顺序

### 1. 先判断你改的是哪一层

- 页面行为：`src/content/`
- 后台消息或任务：`src/background/`
- 转换逻辑：`src/core/converter/`
- 设置和存储：`src/ui/settings/`、`src/utils/storage.js`
- Popup：`src/ui/popup/`

### 2. 再选验证场景

这个项目最稳的验证方式不是只看单元测试，而是直接跑真实页面。

建议至少覆盖这四组手工验证：

#### 标准模式成功路径

1. 选择一篇 ar5iv 已可用的旧论文
2. 点击 `Markdown`
3. 确认下载的是 `.md`
4. 打开文件检查 frontmatter、公式、标题和表格

#### 标准模式回退路径

1. 选择一篇 ar5iv 暂不可用的论文
2. 确认页面提示“仍可使用 PDF 兜底”
3. 点击 `Markdown`
4. 确认最终下载的是 PDF

#### MinerU 路径

1. 在设置页填入有效 Token 并切换到 `MinerU Mode`
2. 回到论文页点击 `Markdown`
3. 打开 Popup，看任务是否进入 `Pending/Processing`
4. 等待完成后验证 ZIP 下载、重试、删除、复制链接

#### 设置页路径

1. 切换语言
2. 修改通知、自动提示、metadata 开关
3. 保存后刷新页面
4. 验证设置是否真正生效

## 调试入口

### 内容脚本

在 arXiv 摘要页按 `F12`，查看页面 Console。

适合排查：

- 按钮没有注入
- 进度 UI 没更新
- Markdown 转换异常
- 页面内下载失败

### Background Service Worker

路径：

`chrome://extensions/ -> 当前扩展 -> Service Worker -> Inspect`

适合排查：

- 消息分发失败
- ar5iv 可用性检测
- MinerU 轮询与下载
- 通知与任务管理异常

### Popup

右键扩展图标，选择检查 Popup。

适合排查：

- 任务列表不刷新
- 重试、删除、复制链接无效
- 翻译和状态渲染问题

### Settings

打开扩展设置页后直接检查页面 Console。

适合排查：

- Token 测试失败
- 设置无法保存
- 语言切换或统计展示异常

## 关键代码入口

建议按这个顺序阅读：

1. `src/manifest.json`
2. `src/content/index.js`
3. `src/background/index.js`
4. `src/core/converter/index.js`
5. `src/core/converter/ar5iv-converter.js`
6. `src/core/converter/mineru-client.js`
7. `src/core/task-manager.js`
8. `src/ui/popup/popup.js`
9. `src/ui/settings/settings.js`

如果你想系统入门，继续看 [docs/mentor/README.md](./mentor/README.md)。

## 文档同步要求

只要改了下面这些行为，必须同步更新文档：

- 用户看到的按钮、弹窗、设置项
- 转换链路或失败兜底逻辑
- Token、存储、隐私边界
- Popup 的任务行为
- 安装、构建、打包流程

通常至少要检查这些文件：

- `README.md`
- `README_CN.md`
- `docs/FAQ.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `PRIVACY.md`

## 发布前清单

1. 更新 `package.json` 和 `src/manifest.json` 版本号
2. 运行 `npm run build`
3. 运行 `npm run lint`
4. 运行 `npm test`
5. 至少做一次标准模式手测
6. 如果改了 MinerU 相关逻辑，再做一次 MinerU 手测
7. 运行 `npm run package`
8. 检查 `build/` 中生成的 ZIP
