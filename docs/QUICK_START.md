# 快速开始指南

欢迎使用 arXiv to Markdown！本指南将帮助你在 5 分钟内开始使用。

## 📦 安装

### 方式 1: Chrome Web Store（推荐）

1. 访问 [Chrome Web Store 链接](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
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

### 第一步：转换你的第一篇论文

1. 访问任意 arXiv 论文页面，例如：
   ```
   https://arxiv.org/abs/1706.03762
   ```

2. 在页面顶部（PDF 下载链接旁）找到紫色的 **"保存为 Markdown"** 按钮

3. 点击按钮，等待转换完成（通常 <1 秒）

4. Markdown 文件会自动下载，文件名格式为：
   ```
   [2017] Attention Is All You Need - Vaswani.md
   ```

### 效果示例

**下载的 Markdown 包含：**
- ✅ 完整的论文内容
- ✅ LaTeX 公式（如 `$x = \sum_{i=1}^n a_i$`）
- ✅ 图片链接（ar5iv CDN）
- ✅ 表格（GitHub Flavored Markdown 格式）
- ✅ 元数据（标题、作者、arXiv ID）

## ⚙️ 配置 MinerU（可选，推荐）

### 为什么需要 MinerU？

- ar5iv 覆盖约 **85%** 的论文
- 剩余 **15%** 无法转换（复杂 LaTeX、特殊宏包）
- 配置 MinerU 后，这些论文也能完美转换！

### 获取 MinerU Token

1. 访问 [mineru.net](https://mineru.net)

2. 注册账号（免费）

3. 登录后，在控制台找到 **API Token**

4. 复制 Token（类似 `sk_xxxxxxxxxxxxx`）

### 配置步骤

1. 点击浏览器工具栏的 arXiv to Markdown 图标

2. 点击"设置"按钮

3. 在"MinerU API 配置"部分粘贴 Token

4. 点击"保存设置"

5. 完成！现在插件会自动使用 MinerU 处理 ar5iv 无法转换的论文

### 免费额度

- 每天 **2000 页**解析额度
- 对于个人使用完全足够
- 超过额度会自动降级到 PDF 下载

## 🎯 转换模式说明

### 快速模式（Fast Mode）
```
只使用 ar5iv + 本地转换
速度: <1 秒
优点: 极快、完全免费、隐私友好
缺点: 15% 论文可能失败
```

### 质量模式（Quality Mode）⭐ 默认
```
ar5iv 优先，失败时自动调用 MinerU
速度: 85% 场景 <1 秒，15% 场景 5-15 秒
优点: 平衡速度和质量，覆盖所有论文
推荐: 配置 MinerU Token 后使用
```

### 极致模式（Always MinerU）
```
始终使用 MinerU 解析 PDF
速度: 5-15 秒
优点: 质量最高，完美处理复杂论文
缺点: 较慢，消耗 MinerU 额度
适用: 重要论文、需要引用原文
```

## 📊 查看统计

点击扩展图标可查看：
- 总转换次数
- ar5iv 成功次数
- MinerU 使用次数
- PDF 兜底次数

## 💡 使用技巧

### 1. 批量保存论文

在 arXiv 搜索结果页，逐个点击论文 → 点击"保存为 Markdown" → 返回

### 2. 集成到笔记工具

**Obsidian:**
```markdown
# 设置默认下载路径
浏览器设置 → 下载内容 → 保存到: D:\Obsidian\Papers
```

**Notion:**
```markdown
下载 Markdown → 拖拽到 Notion 页面即可导入
```

### 3. 快捷键（计划中）

未来将支持：
- `Alt+M`: 快速转换当前论文
- `Alt+Shift+M`: 打开设置

## ❓ 常见问题

### Q1: 转换失败怎么办？

**A:** 插件会自动降级处理：
1. 首先尝试 ar5iv
2. 失败后调用 MinerU（如已配置）
3. 最后下载 PDF（文件名仍是有意义的）

### Q2: 转换很慢？

**A:** 
- ar5iv 模式通常 <1 秒
- 如果超过 5 秒，说明在使用 MinerU 深度解析
- 查看页面提示了解当前状态

### Q3: 公式显示不正确？

**A:**
- ar5iv 的公式已经是 LaTeX 格式（`$...$` 或 `$$...$$`）
- 在 Obsidian/Typora 中可直接渲染
- 在 VS Code 中需要安装 Markdown Preview Enhanced 插件

### Q4: 图片无法显示？

**A:**
- 图片链接指向 ar5iv CDN，需要联网
- 未来版本将支持"打包下载"（图片一起保存）

### Q5: 支持其他论文网站吗？

**A:**
- 当前仅支持 arXiv
- 计划支持：bioRxiv, medRxiv, SSRN 等
- 欢迎在 GitHub Issues 提出需求

## 🆘 获取帮助

- **文档**: [README.md](../README.md)
- **架构**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **开发**: [DEVELOPMENT.md](DEVELOPMENT.md)
- **反馈**: [GitHub Issues](https://github.com/yourusername/arxiv-md/issues)

## 🎉 下一步

- ⭐ 在 [GitHub](https://github.com/yourusername/arxiv-md) 给项目点个 Star
- 📢 分享给你的同事和朋友
- 💬 在社交媒体上提及我们

---

祝你阅读愉快！📚✨

