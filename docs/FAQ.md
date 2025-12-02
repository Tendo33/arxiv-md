# 常见问题（FAQ）

## 🎯 基础使用

### Q: 如何使用这个插件？

**A:** 访问任意 arXiv 论文页面（如 `https://arxiv.org/abs/1706.03762`），点击页面顶部的"保存为 Markdown"按钮即可。

### Q: 支持哪些网站？

**A:** 目前仅支持 arXiv.org。计划未来支持 bioRxiv、medRxiv 等学术预印本网站。

### Q: 需要付费吗？

**A:**

- 插件本身**完全免费**
- ar5iv 转换**完全免费**
- MinerU 提供**免费额度**（每天 2000 页）

---

## 🔧 配置与设置

### Q: MinerU Token 是必须的吗？

**A:** 不是必须的。不配置 Token，插件依然可以：

- 使用 ar5iv 转换 85% 的论文
- ar5iv 失败时下载 PDF（文件名有意义）

配置 Token 后的优势：

- 可以转换 ar5iv 不支持的论文
- 质量更高（完美处理公式、表格）

### Q: 如何获取 MinerU Token？

**A:**

1. 访问 [mineru.net](https://mineru.net)
2. 注册免费账号
3. 在控制台复制 API Token
4. 在插件设置中粘贴并保存

### Q: MinerU 有使用限制吗？

**A:**

- 免费账号：每天 2000 页
- 单文件：最大 200MB，最多 600 页
- 对个人使用完全足够

### Q: 哪种转换模式最好？

**A:**

- **日常使用**：质量模式（默认）
- **追求速度**：快速模式
- **重要论文**：极致模式（MinerU）

---

## 🚀 转换相关

### Q: 转换需要多长时间？

**A:**

- **ar5iv 模式**：< 1 秒
- **MinerU 模式**：5-15 秒
- **PDF 下载**：立即

### Q: 转换失败怎么办？

**A:** 插件有三层保障：

1. **Tier 1**: ar5iv（失败率 15%）
2. **Tier 2**: MinerU 深度解析（需配置 Token）
3. **Tier 3**: PDF 下载（始终有效）

### Q: 为什么有些论文转换失败？

**A:** 可能原因：

- ar5iv 尚未转换该论文（通常是非常新或非常老的论文）
- LaTeX 源码使用了特殊宏包
- PDF 结构过于复杂

**解决方案**：配置 MinerU Token

### Q: 转换的 Markdown 质量如何？

**A:**

- **ar5iv 模式**：
  - 公式：✅ 完美（LaTeX 格式）
  - 表格：✅ 良好（GFM 格式）
  - 图片：✅ 外链（ar5iv CDN）
  - 排版：✅ 保留结构
- **MinerU 模式**：
  - 公式：✅ 完美（原生 LaTeX）
  - 表格：✅ 完美（高精度识别）
  - 图片：✅ 可提取
  - 排版：✅ 智能重构

---

## 📄 内容相关

### Q: Markdown 中包含图片吗？

**A:** 包含。图片以外链形式存在（指向 ar5iv CDN），需要联网查看。

**示例：**

```markdown
![Figure 1](https://arxiv.org/html/1706.03762/figure1.png)
```

**未来计划**：支持"打包下载"选项（图片一起下载）

### Q: 公式如何显示？

**A:** 公式以 LaTeX 格式保存：

- 行内公式：`$x = y$`
- 块级公式：`$$E = mc^2$$`

**支持工具：**

- Obsidian（原生支持）
- Typora（原生支持）
- VS Code（需 Markdown Preview Enhanced 插件）
- Notion（需手动转换）

### Q: 表格格式是什么？

**A:** GitHub Flavored Markdown (GFM) 格式：

```markdown
| 列1 | 列2 | 列3 |
| --- | --- | --- |
| A   | B   | C   |
```

所有现代 Markdown 编辑器都支持。

### Q: Markdown 包含元数据吗？

**A:** 是的。文件头部包含 YAML Front Matter：

```yaml
---
title: Attention Is All You Need
arxiv_id: 1706.03762
source: ar5iv
converted_at: 2025-12-01T21:18:25+08:00
---
```

可以在设置中禁用此功能。

---

## 🛠️ 技术问题

### Q: 为什么按钮没有出现？

**A:** 可能原因：

1. 不在 arXiv Abstract 页面（PDF 页面不显示）
2. 页面未加载完成（等待几秒）
3. 扩展被禁用（检查 `chrome://extensions/`）

**解决方案**：

- 刷新页面
- 确认扩展已启用
- 查看控制台错误（F12）

### Q: 点击按钮没反应？

**A:**

1. 打开 Chrome 控制台（F12）查看错误
2. 检查网络连接
3. 尝试重启浏览器
4. 在 GitHub 提交 Issue

### Q: 下载的文件名乱码？

**A:** 可能是浏览器编码问题：

- Chrome: 设置 → 高级 → 下载内容 → 编码（选择 UTF-8）
- 检查论文标题是否包含特殊字符

### Q: 能在无痕模式使用吗？

**A:** 可以，但需要：

1. 打开 `chrome://extensions/`
2. 找到 arXiv to Markdown
3. 点击"详情"
4. 开启"在无痕模式下启用"

### Q: 支持 Firefox 吗？

**A:**

- 当前：仅支持 Chrome/Edge（Chromium 内核）
- 计划中：Firefox 版本（使用 WebExtension API）

---

## 🔒 隐私与安全

### Q: 插件会收集我的数据吗？

**A:** **不会**。插件：

- ✅ 100% 本地处理（ar5iv 模式）
- ✅ 不发送任何数据到我们的服务器
- ✅ MinerU Token 加密存储在本地

### Q: MinerU Token 安全吗？

**A:**

- Token 存储在 `chrome.storage.sync`（Chrome 加密）
- 仅在调用 MinerU API 时使用
- 不会发送到任何其他地方

### Q: 需要哪些权限？

**A:**

- `storage`: 保存配置和统计
- `downloads`: 下载 Markdown 文件
- `activeTab`: 读取当前论文页面
- `notifications`: 显示转换结果
- `host_permissions`: 访问 arxiv.org、ar5iv.org、mineru.net

所有权限都是必要的，不会过度使用。

---

## 💡 高级用法

### Q: 可以批量转换吗？

**A:**

- 当前版本：不支持（需逐个点击）
- 未来版本：计划添加批量转换功能

### Q: 能自动转换吗？

**A:**

- 可以在设置中开启"自动转换"（计划中的功能）
- 进入论文页面自动弹出转换提示

### Q: 如何集成到 Obsidian？

**A:**

1. 在 Chrome 设置中：下载内容 → 位置 → 选择 Obsidian Vault 目录
2. 下载的 Markdown 会直接出现在 Obsidian 中
3. 在 Obsidian 中可直接查看和编辑

### Q: 如何集成到 Notion？

**A:**

1. 下载 Markdown 文件
2. 拖拽到 Notion 页面
3. Notion 会自动导入（但公式需要手动转换）

### Q: 支持自定义模板吗？

**A:**

- 当前版本：不支持
- 未来版本：计划支持自定义 Markdown 模板

---

## 🐛 故障排除

### Q: 扩展图标是灰色的？

**A:** 可能原因：

- 不在 arXiv 页面（扩展仅在 arXiv 激活）
- 扩展被禁用

### Q: 统计数据不更新？

**A:**

- 检查 Chrome Storage 权限
- 尝试清除并重新安装扩展
- 数据存储在本地，卸载会丢失

### Q: 转换后文件找不到？

**A:**

- 检查 Chrome 下载设置（`chrome://settings/downloads`）
- 查看默认下载位置
- 检查下载记录（`Ctrl+J`）

---

## 📞 获取帮助

### Q: 如何报告 Bug？

**A:**

1. 访问 [GitHub Issues](https://github.com/yourusername/arxiv-md/issues)
2. 点击"New Issue"
3. 选择"Bug Report"模板
4. 提供详细信息：
   - 浏览器版本
   - 扩展版本
   - 复现步骤
   - 错误截图

### Q: 如何提出功能建议？

**A:**

1. 在 GitHub Issues 点击"New Issue"
2. 选择"Feature Request"模板
3. 描述你的需求和使用场景

### Q: 如何参与贡献？

**A:**

1. 阅读 [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Fork 项目仓库
3. 提交 Pull Request

---

## 🎓 其他

### Q: 这是官方工具吗？

**A:** 不是。这是独立开发的第三方工具，与 arXiv 官方无关。

### Q: 可以商用吗？

**A:** 可以。本项目采用 MIT License，允许商用。

### Q: 如何支持项目？

**A:**

- ⭐ 在 GitHub 给项目点 Star
- 📢 分享给同事和朋友
- 💰 赞助开发者（GitHub Sponsors）
- 🤝 贡献代码或文档

---

**还有其他问题？** 请在 [GitHub Discussions](https://github.com/yourusername/arxiv-md/discussions) 提问！
