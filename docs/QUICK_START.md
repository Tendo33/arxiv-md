# 快速开始指南

欢迎使用 arXiv to Markdown！本指南将帮助你在 5 分钟内开始使用。

## 📦 安装

### 方式 1: Chrome Web Store（推荐）

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore)（即将推出）
2. 点击"添加至 Chrome"按钮
3. 确认权限并完成安装

### 方式 2: 手动安装（开发版）

```bash
# 克隆项目
git clone https://github.com/yourusername/arxiv-md.git
cd arxiv-md

# 安装依赖
npm install

# 构建扩展
npm run build
```

然后在 Chrome 中：

1. 打开 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目中的 `dist` 目录

## 🚀 基础使用

### 只需三步，开始转换

#### 第一步：访问论文

打开任意 arXiv 论文页面，例如：

```
https://arxiv.org/abs/1706.03762
```

💡 **提示**：确保是 Abstract 页面（URL 包含 `/abs/`），而非 PDF 页面。

#### 第二步：点击按钮

在页面顶部（PDF 下载链接旁）找到紫色的 **"保存为 Markdown"** 按钮并点击。

> 💡 **注意**：如果按钮未显示，说明 ar5iv 尚未收录该论文（通常是刚发布的新论文）。此时请使用 **"保存 PDF"** 功能。

#### 第三步：等待下载

- **快速转换**（85% 论文）：<1 秒完成
- **深度转换**（15% 论文）：5-15 秒完成
- 文件自动下载，文件名格式：`(年份) 标题 - 作者.md`

🎉 **完成！** 你已经成功将论文转换为 Markdown。

## ⚙️ 配置 MinerU（可选）

### 为什么需要 MinerU？

- 默认的 ar5iv 模式覆盖 **85%** 的论文
- 配置 MinerU 后，剩余 **15%** 也能完美转换
- **免费额度**：每天 2000 页，足够个人使用

### 快速配置（3 步）

1. **注册账号**：访问 [mineru.net](https://mineru.net) 注册（免费）
2. **获取 Token**：登录后在控制台复制 API Token
3. **保存配置**：点击插件图标 → 设置 → 粘贴 Token → 保存

✅ **配置完成！** 现在所有论文都能转换了。

## 🎯 转换模式

### 质量模式 ⭐ 推荐（默认）

```
ar5iv 优先（快速） → 失败时自动调用 MinerU（质量）
```

- 85% 论文 <1 秒完成
- 15% 论文 5-15 秒完成
- 覆盖所有论文，无需手动切换

### 其他模式

**快速模式**：只用 ar5iv，不消耗 MinerU 配额（15% 论文会失败）  
**极致模式**：所有论文都用 MinerU（最高质量，但较慢）

💡 **建议**：新手直接使用默认的"质量模式"，无需修改。

## 💡 实用技巧

### 集成到 Obsidian

在 Chrome 设置中将默认下载路径改为 Obsidian Vault 目录：

```
Chrome 设置 → 下载内容 → 位置 → 选择 D:\Obsidian\Papers
```

下载的 Markdown 会直接出现在 Obsidian 中，公式自动渲染。

### 集成到 Notion

1. 下载 Markdown 文件
2. 拖拽到 Notion 页面
3. Notion 自动导入（公式需手动调整）

## ❓ 遇到问题？

### 快速自查

- **按钮没出现**：可能是新论文 ar5iv 尚未收录（正常现象），或请刷新页面重试
- **转换失败**：打开控制台（F12）查看错误，或切换转换模式
- **速度很慢**：说明在使用 MinerU 深度解析，属于正常现象

### 详细帮助

- 📖 [完整 FAQ](FAQ.md) - 50+ 个常见问题解答
- 🐛 [GitHub Issues](https://github.com/[你的GitHub用户名]/arxiv-md/issues) - 报告 Bug
- 💬 [Discussions](https://github.com/[你的GitHub用户名]/arxiv-md/discussions) - 提问交流

---

祝你阅读愉快！📚✨
