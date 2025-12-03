# 发布到 Chrome 应用商店指南

本文档详细说明了如何将 arXiv-md 插件打包并发布到 Google Chrome 应用商店。

## 1. 准备工作

### 注册开发者账号
如果你还没有 Chrome 开发者账号：
1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)。
2. 使用 Google 账号登录。
3. 支付 $5.00 美元的一次性注册费。

## 2. 打包插件

我们需要将插件代码打包成 `.zip` 文件。

### 方法 A：使用内置打包脚本（推荐）

项目包含一个自动打包脚本，但首先需要安装依赖。

1. **安装依赖**
   由于打包脚本依赖 `archiver`，请先安装它：
   ```bash
   npm install --save-dev archiver
   ```

2. **构建并打包**
   运行以下命令：
   ```bash
   npm run package
   ```
   
   这将自动执行以下操作：
   - 运行 `npm run build` 编译生产环境代码到 `dist/` 目录。
   - 将 `dist/` 目录的内容压缩为 `build/arxiv-md-v1.0.0.zip`（版本号取决于 `manifest.json`）。

### 方法 B：手动打包

1. **构建项目**
   ```bash
   npm run build
   ```

2. **压缩文件**
   - 进入 `dist` 目录。
   - 选中所有文件（`manifest.json`, `background.js`, `assets/`, 等）。
   - 右键 -> 发送到 -> 压缩(zipped)文件夹。
   - **注意**：不要直接压缩 `dist` 文件夹本身，而是压缩其**内容**。解压后应该直接看到 `manifest.json`。

## 3. 上传到应用商店

1. 打开 [开发者仪表板](https://chrome.google.com/webstore/developer/dashboard)。
2. 点击右上角的 **"New Item" (新建项目)**。
3. 点击 **"Upload"** 并选择上一步生成的 `.zip` 文件。

## 4. 填写商店信息

上传成功后，你需要填写以下信息：

### 商店列表 (Store Listing)
- **Description (描述)**: 详细介绍插件功能。
- **Graphic Assets (图像资源)**:
  - **Store Icon**: 128x128 px (PNG).
  - **Screenshots**: 至少一张，推荐 1280x800 px。
  - **Marquee Promo Tile**: 440x280 px (可选，但推荐用于推广).

### 隐私权 (Privacy)
- **Privacy Policy (隐私政策)**: 如果插件收集用户数据，必须提供隐私政策链接。由于本项目仅在本地处理数据，你可以声明不收集个人数据。
- **Permissions Justification**: 解释为什么需要 `storage`, `downloads` 等权限。
  - `storage`: 保存用户设置。
  - `downloads`: 下载转换后的 Markdown 文件。
  - `activeTab`: 读取当前 arXiv 页面内容。

## 5. 提交审核

1. 检查所有必填项是否已完成。
2. 点击右上角的 **"Submit for Review" (提交审核)**。
3. 审核通常需要 1-3 个工作日。

## 常见问题

- **Manifest V3**: 本项目使用 Manifest V3，完全符合 Chrome 商店的最新要求。
- **更新插件**: 如果需要更新版本，请在 `package.json` 和 `src/manifest.json` 中增加版本号，重新打包，然后在仪表板中选择现有项目并 "Upload New Package"。
