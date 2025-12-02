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

### 步骤 5: 验证安装

#### 5.1 扩展状态检查

1. 在 `chrome://extensions/` 页面确认：
   - ✅ 扩展名称：arXiv to Markdown
   - ✅ 版本号：1.0.0
   - ✅ 状态：已启用（蓝色开关）
   - ✅ 无错误提示

#### 5.2 功能测试

1. 访问测试论文：https://arxiv.org/abs/1706.03762
2. 等待页面完全加载（约 2-3 秒）
3. 检查按钮注入：
   - 在 PDF 下载链接旁应该出现紫色的"保存为 Markdown"按钮
   - 按钮有渐变背景和阴影效果
4. 测试转换：
   - 点击"保存为 Markdown"
   - 应显示"转换中..."Toast 通知
   - 1-3 秒后文件自动下载
   - 文件名：`(2017) Attention Is All You Need - Vaswani.md`
5. 检查文件内容：
   - 打开下载的 Markdown 文件
   - 应包含 YAML Front Matter（title, arxiv_id 等）
   - 应包含论文正文和公式（LaTeX 格式）

#### 5.3 故障诊断（如有问题）

**按钮未出现**：
- 打开控制台（F12），查看是否有红色错误
- 确认页面 URL 是 `/abs/` 而非 `/pdf/`
- 尝试刷新页面

**转换失败**：
- 检查网络连接
- 查看 Service Worker 状态（chrome://extensions/ → 详情 → Service Worker）
- 查看控制台错误日志

**如果一切正常，恭喜你安装成功！** 🎉

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

### 问题 6: 文件下载失败

**可能原因**：浏览器下载权限被阻止

**解决方案**：

1. 检查浏览器设置：
   - Chrome 设置 → 隐私和安全 → 网站设置 → 自动下载
   - 确保 arxiv.org 允许自动下载
2. 检查扩展权限：
   - chrome://extensions/ → 详情
   - 确认"下载"权限已授予
3. 手动允许下载：
   - 转换时浏览器地址栏可能有弹窗
   - 点击"允许"

### 问题 7: Service Worker 频繁停用

**可能原因**：Chrome 的 Service Worker 生命周期管理

**解决方案**：

这是正常现象，不影响功能。Service Worker 会在需要时自动激活。

如需手动激活：
1. chrome://extensions/ → 详情
2. 找到"Service Worker"部分
3. 点击"查看视图"（会激活 Worker）

### 问题 8: 转换的 Markdown 乱码

**可能原因**：文件编码问题

**解决方案**：

1. 使用 UTF-8 编码的编辑器打开（推荐 VS Code、Typora）
2. 如果用记事本打开，选择"另存为" → 编码选择 UTF-8

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

| 特性 | 开发模式 (`npm run dev`) | 生产模式 (`npm run build`) |
|------|-------------------------|---------------------------|
| **自动编译** | ✅ 监听文件变化 | ❌ 一次性构建 |
| **Source Maps** | ✅ 完整映射 | ❌ 无（减小体积） |
| **代码压缩** | ❌ 未压缩 | ✅ 完全压缩 |
| **Console 日志** | ✅ 详细日志 | ⚠️ 仅错误日志 |
| **文件体积** | 较大（~2MB） | 较小（~500KB） |
| **启动速度** | 较慢 | 较快 |
| **适用场景** | 本地开发调试 | 发布和分享 |

### 如何切换模式

**开发时**：
```bash
npm run dev  # 保持运行，自动重新编译
```

每次修改代码后：
1. 文件自动编译到 `dist/`
2. 在 chrome://extensions/ 点击"重新加载"图标
3. 刷新测试页面

**发布前**：
```bash
npm run build  # 一次性构建
npm run package  # 打包 ZIP
```

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

## ⚙️ 安装后配置

安装完成后，建议进行以下配置以获得最佳体验：

### 1. 配置 MinerU（推荐）

**为什么配置**：
- ar5iv 覆盖 85% 论文，配置 MinerU 后可达 100%
- 免费账号每天 2000 页额度，足够个人使用

**快速配置**：
1. 访问 [mineru.net](https://mineru.net) 注册账号
2. 登录后在控制台复制 API Token
3. 点击插件图标 → 设置 → 粘贴 Token → 保存

详细步骤见 [QUICK_START.md](docs/QUICK_START.md#配置-mineru)

### 2. 设置默认下载路径（可选）

**为 Obsidian 用户**：
```
Chrome 设置 → 下载内容 → 位置 → 选择 Obsidian Vault 目录
```

**为 Notion 用户**：
保持默认路径，下载后手动拖拽到 Notion

### 3. 选择转换模式（可选）

插件默认使用"质量模式"（ar5iv 优先，失败时自动调用 MinerU），大多数情况下无需修改。

**如需修改**：
- 插件图标 → 设置 → 转换模式
- 快速模式：只用 ar5iv（更快，但 15% 论文会失败）
- 极致模式：所有论文都用 MinerU（最高质量，但较慢）

### 4. 启用桌面通知（可选）

在设置中开启"桌面通知"，转换完成后会有系统通知提醒。

---

## 🆘 需要帮助？

- **文档**: [README.md](README.md)
- **问题**: [GitHub Issues](https://github.com/[你的GitHub用户名]/arxiv-md/issues)
- **讨论**: [GitHub Discussions](https://github.com/[你的GitHub用户名]/arxiv-md/discussions)

---

祝你使用愉快！📚✨
