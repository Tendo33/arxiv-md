# 安装说明

## 🎯 开发者安装（当前状态）

由于项目刚刚创建完成，目前需要手动构建和安装。

### 前置要求

- Node.js >= 16.x
- npm >= 8.x
- Chrome 或 Edge 浏览器

### 步骤 1: 安装依赖

```bash
cd arxiv-md
npm install
```

这将安装以下依赖：

- `@mozilla/readability` - HTML 内容提取
- `turndown` + `turndown-plugin-gfm` - Markdown 转换
- Webpack、Babel 等构建工具

### 步骤 2: 创建图标文件

在安装之前，你需要在 `assets/` 目录下放置三个图标文件：

```
assets/
├── icon-16.png   (16x16 像素)
├── icon-48.png   (48x48 像素)
└── icon-128.png  (128x128 像素)
```

**临时方案**：如果你只是想快速测试，可以使用任意 PNG 图片重命名即可。

**推荐设计**：

- 主题：Markdown 文档图标 + arXiv 元素
- 颜色：紫色渐变 (#667eea → #764ba2)
- 风格：现代、简洁、扁平化

### 步骤 3: 构建扩展

```bash
# 开发模式（自动监听文件变化）
npm run dev

# 或者生产构建（一次性）
npm run build
```

构建完成后，会在 `dist/` 目录生成所有文件。

### 步骤 4: 在 Chrome 中加载

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的 **"开发者模式"**
4. 点击 **"加载已解压的扩展程序"**
5. 选择项目中的 `dist` 目录
6. 完成！扩展应该出现在工具栏

### 步骤 5: 测试

1. 访问任意 arXiv 论文页面：

   ```
   https://arxiv.org/abs/1706.03762
   ```

2. 查看页面顶部是否出现 **"保存为 Markdown"** 按钮

3. 点击按钮测试转换功能

4. 检查浏览器控制台（F12）查看日志

---

## 🐛 故障排查

### 问题 1: `npm install` 失败

**可能原因**：网络问题或 Node.js 版本过低

**解决方案**：

```bash
# 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com

# 或者升级 Node.js
node -v  # 检查版本，应该 >= 16.x
```

### 问题 2: `npm run build` 报错

**可能原因**：Webpack 配置问题或依赖缺失

**解决方案**：

```bash
# 清除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 问题 3: 扩展加载后显示错误

**可能原因**：图标文件缺失或路径错误

**解决方案**：

1. 检查 `dist/assets/` 目录是否有三个图标文件
2. 如果没有，创建占位图标或从其他地方复制
3. 重新构建：`npm run build`
4. 在 `chrome://extensions/` 点击"重新加载"

### 问题 4: 按钮没有出现

**可能原因**：Content Script 未注入

**解决方案**：

1. 打开 arXiv Abstract 页面（不是 PDF 页面）
2. 按 F12 打开控制台，查看是否有错误
3. 检查 `manifest.json` 中的 `content_scripts` 配置
4. 尝试刷新页面

### 问题 5: 转换功能不工作

**可能原因**：Background Worker 未启动

**解决方案**：

1. 访问 `chrome://extensions/`
2. 找到扩展，点击"详情"
3. 查看"Service Worker"状态
4. 如果显示"已停用"，点击"查看视图"激活

---

## 📦 生产安装（Chrome Web Store）

**当前状态**：项目尚未发布到 Chrome Web Store

**未来安装方式**：

1. 访问 Chrome Web Store
2. 搜索 "arXiv to Markdown"
3. 点击"添加至 Chrome"
4. 完成安装

**如果你想发布到 Chrome Web Store**：

1. 完成上述构建步骤
2. 运行 `npm run package` 生成 ZIP 文件
3. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. 上传 ZIP 文件
5. 填写商店详情并提交审核

---

## 🔧 开发模式 vs 生产模式

### 开发模式 (`npm run dev`)

- 自动监听文件变化
- 包含 source maps
- 详细的控制台日志
- 未压缩的代码
- 适合调试

### 生产模式 (`npm run build`)

- 一次性构建
- 代码压缩和优化
- 去除 console.log
- 较小的文件体积
- 适合发布

---

## 📚 下一步

安装完成后，请阅读：

- [QUICK_START.md](docs/QUICK_START.md) - 快速开始指南
- [FAQ.md](docs/FAQ.md) - 常见问题解答
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) - 如果你想参与开发

---

## 💡 提示

### MinerU Token（可选）

为了获得最佳体验，建议配置 MinerU Token：

1. 访问 [mineru.net](https://mineru.net)
2. 注册免费账号
3. 获取 API Token
4. 在扩展设置中配置

**好处**：

- 可以转换 ar5iv 不支持的 15% 论文
- 质量更高（完美处理公式、表格）
- 免费账号每天 2000 页额度

---

## 🆘 需要帮助？

- **文档**: [README.md](README.md)
- **问题**: [GitHub Issues](https://github.com/yourusername/arxiv-md/issues)
- **讨论**: [GitHub Discussions](https://github.com/yourusername/arxiv-md/discussions)

---

祝你使用愉快！📚✨
