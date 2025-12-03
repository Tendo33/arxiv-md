# Arxiv-MD 开发入门指南

欢迎来到 Arxiv-MD 项目！如果你是 JavaScript 和浏览器插件开发的新手，这份文档将手把手教你如何开始。

## 1. 环境准备

在开始之前，你需要安装以下工具：

1.  **Node.js**: 这是一个 JavaScript 运行环境。请访问 [nodejs.org](https://nodejs.org/) 下载并安装最新稳定版 (LTS)。
2.  **代码编辑器**: 推荐使用 [VS Code](https://code.visualstudio.com/)。
3.  **Google Chrome 浏览器**: 用于测试插件。

安装完成后，打开终端（命令行），输入以下命令检查是否安装成功：

```bash
node -v
npm -v
```

如果能看到版本号，说明环境准备好了。

## 2. 安装与运行

### 第一步：安装依赖

在项目根目录下打开终端，运行：

```bash
npm install
```

这个命令会根据 `package.json` 文件下载项目所需的所有依赖包到 `node_modules` 文件夹。

### 第二步：启动开发模式

运行以下命令：

```bash
npm run dev
```

这个命令会启动 Webpack，它会将 `src` 目录下的源代码打包到 `dist` 目录。`--watch` 参数意味着当你修改代码时，它会自动重新打包。

**注意**：保持这个终端窗口开启，不要关闭。

### 第三步：在 Chrome 中加载插件

1.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车。
2.  在右上角打开 **"开发者模式" (Developer mode)** 开关。
3.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)** 按钮。
4.  选择本项目目录下的 `dist` 文件夹。

现在，你应该能在浏览器工具栏看到 Arxiv-MD 的图标了！

## 3. 项目结构

了解文件结构有助于你快速定位代码：

*   **`src/`**: 源代码目录（你主要在这里工作）。
    *   **`manifest.json`**: 插件的配置文件。定义了插件名称、权限、入口文件等。
    *   **`background/`**: 后台脚本。插件运行在后台的逻辑，例如监听图标点击事件。
    *   **`content/`**: 内容脚本。运行在网页（如 arXiv 页面）中的代码，可以读取和修改网页内容。
    *   **`ui/`**: 界面相关代码。
        *   `popup/`: 点击插件图标弹出的窗口。
        *   `settings/`: 设置页面。
    *   **`core/`**: 核心逻辑，例如 HTML 转 Markdown 的转换器。
*   **`dist/`**: 打包后的代码（不要直接修改这里，每次构建都会被覆盖）。
*   **`package.json`**: 项目配置和依赖列表。
*   **`webpack.config.js`**: 打包工具 Webpack 的配置。

## 4. 快速上手开发

### 场景一：修改弹出窗口 (Popup) 的样式

1.  找到 `src/ui/popup/style.css`。
2.  修改 CSS 样式，例如改变背景色。
3.  保存文件。
4.  查看终端，确认 Webpack 重新编译成功。
5.  在 Chrome 扩展程序页面点击刷新图标（或者重新打开 Popup），就能看到变化。

### 场景二：修改 Markdown 转换逻辑

1.  核心逻辑在 `src/core/` 目录下。
2.  如果你想修改某个 HTML 标签如何转换为 Markdown，可以查看 `src/core/turndown-plugin-gfm.js` 或相关文件。

### 场景三：调试代码

*   **Popup/Settings**: 在弹窗或设置页右键点击 -> "检查" (Inspect)，会打开开发者工具 (DevTools)。你可以在 Console 面板看到 `console.log` 的输出。
*   **Content Script**: 在 arXiv 网页上右键点击 -> "检查"，Console 面板会显示内容脚本的日志。
*   **Background Script**: 在 `chrome://extensions/` 页面，找到本插件，点击 "背景页" (service worker) 链接，会打开一个独立的开发者工具窗口。

## 5. 常见问题

*   **修改了代码没生效？**
    *   确保 `npm run dev` 正在运行且没有报错。
    *   如果是修改了 `manifest.json` 或 `background` 脚本，通常需要在 `chrome://extensions/` 页面点击刷新按钮重新加载插件。
    *   如果是 Content Script，需要刷新当前的 arXiv 网页。

祝你开发愉快！如果有问题，可以随时查阅相关文档或询问 AI 助手。
