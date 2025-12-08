# FAQ | 常见问题

## 🎯 Basic Usage | 基础使用

### Q: How do I use this extension? | 如何使用这个插件？

**A:** Visit any arXiv paper page (e.g., `https://arxiv.org/abs/1706.03762`), click the "Save as Markdown" button at the top of the page.

**A:** 访问任意 arXiv 论文页面（如 `https://arxiv.org/abs/1706.03762`），点击页面顶部的"Save as Markdown"按钮即可。

### Q: Which websites are supported? | 支持哪些网站？

**A:** Currently only arXiv.org is supported. Future plans include bioRxiv, medRxiv, and other academic preprint websites.

**A:** 目前仅支持 arXiv.org。计划未来支持 bioRxiv、medRxiv 等学术预印本网站。

### Q: Is it free? | 需要付费吗？

**A:**

- The extension itself is **completely free** | 插件本身**完全免费**
- ar5iv conversion is **completely free** | ar5iv 转换**完全免费**

---

## 🔧 Configuration & Settings | 配置与设置

### Q: How do I verify successful installation? | 如何验证安装成功？

**A:** Follow these steps to verify | 按以下步骤验证：

1. **Check extension status | 检查扩展状态**：
   - Open `chrome://extensions/` | 打开 `chrome://extensions/`
   - Confirm "arXiv to Markdown" shows as enabled | 确认 "arXiv to Markdown" 显示为已启用
   - Version should be 1.0.0 | 版本号应为 1.0.0

2. **Test button injection | 测试按钮注入**：
   - Visit test paper: https://arxiv.org/abs/1706.03762 | 访问测试论文
   - Wait for page to fully load (about 2-3 seconds) | 等待页面完全加载（约 2-3 秒）
   - A purple "Save as Markdown" button should appear next to PDF download links | 在 PDF 下载链接旁应该出现紫色的"Save as Markdown"按钮

3. **Test conversion function | 测试转换功能**：
   - Click "Save as Markdown" button | 点击"Save as Markdown"按钮
   - Should show "Converting..." prompt | 应该显示"转换中..."提示
   - File auto-downloads in 1-3 seconds | 1-3 秒后文件自动下载
   - Filename format: `(2017) Attention Is All You Need - Vaswani.md`

4. **Check console (if problems occur) | 检查控制台（如果出现问题）**：
   - Press F12 to open developer tools | 按 F12 打开开发者工具
   - Switch to Console tab | 切换到 Console 标签
   - Check for red error messages | 查看是否有红色错误信息

If all steps work, installation is successful! | 如果以上步骤都正常，说明安装成功！

### Q: Which conversion mode is best? | 哪种转换模式最好？

**A:**

- **Daily use | 日常使用**: Quality mode (default) | 质量模式（默认）
- **Speed priority | 追求速度**: Fast mode | 快速模式

---

## 🚀 Conversion Related | 转换相关

### Q: How long does conversion take? | 转换需要多长时间？

**A:**

- **ar5iv mode**: < 1 second | < 1 秒
- **PDF download**: Instant | 立即

### Q: Why does the "Save as Markdown" button sometimes not show? | 为什么"Save as Markdown"按钮有时候不显示？

**A:** The extension auto-detects if ar5iv has indexed the paper.

**A:** 插件会自动检测 ar5iv 是否已收录该论文。

- **Reason | 原因**: ar5iv needs time (usually 1-2 days) to process newly published papers on arXiv.
- **Solution | 解决方案**: If button doesn't show, ar5iv hasn't generated the HTML version yet. Use "Save PDF" function, or try again in a few days.

### Q: What if conversion fails? | 转换失败怎么办？

**A:** The extension has two-tier protection | 插件有两层保障：

1. **Tier 1**: ar5iv (15% failure rate | 失败率 15%)
2. **Tier 2**: PDF download (always works | 始终有效)

### Q: Why do some papers fail to convert? | 为什么有些论文转换失败？

**A:** Possible reasons | 可能原因：

- ar5iv hasn't converted this paper yet (usually very new or very old papers) | ar5iv 尚未转换该论文（通常是非常新或非常老的论文）
- LaTeX source uses special packages | LaTeX 源码使用了特殊宏包
- PDF structure is too complex | PDF 结构过于复杂

**Solution | 解决方案**: Use PDF download as fallback | 使用 PDF 下载作为备选

### Q: What if conversion progress gets stuck? | 转换进度卡住怎么办？

**A:** Possible reasons and solutions | 可能原因和解决方案：

**Scenario 1: Progress stuck at 0% | 场景 1：进度停在 0%**

- Reason: Network connection issue or ar5iv service unavailable | 原因：网络连接问题或 ar5iv 服务不可用
- Solution: Check network, refresh page and retry | 解决：检查网络，刷新页面重试

**General solutions | 通用解决方案**：

- Open extension Popup to check status | 打开插件 Popup，查看统计信息确认状态
- Check browser console (F12) for error logs | 查看浏览器控制台（F12）的错误日志
- Try closing other tabs to reduce memory usage | 尝试关闭其他标签页减少内存占用

### Q: How do I know which tier conversion is being used? | 如何知道当前使用的是哪一层转换？

**A:** Multiple ways to check | 有多种方式查看：

1. **Toast notification (recommended) | Toast 通知（推荐）**：
   - Notification after conversion shows source | 转换完成后的通知会显示来源
   - "✅ ar5iv" = Tier 1 (fast | 快速)
   - "📄 PDF" = Tier 2 (fallback | 兜底)

2. **Markdown file header | Markdown 文件头部**：
   - Open downloaded Markdown file | 打开下载的 Markdown 文件
   - Check `source` field in YAML Front Matter | 查看 YAML Front Matter 的 `source` 字段

   ```yaml
   ---
   source: ar5iv # or pdf_fallback
   ---
   ```

3. **Extension statistics | 插件统计**：
   - Click extension icon in browser toolbar | 点击浏览器工具栏的插件图标
   - View statistics (ar5iv success count, etc.) | 查看统计数据（ar5iv 成功次数等）

### Q: Why does the same paper convert at different speeds each time? | 为什么同一篇论文每次转换速度不同？

**A:** This is normal, reasons include | 这是正常现象，原因如下：

**First conversion slow (5-15 seconds) | 首次转换慢（5-15 秒）**：

- ar5iv cache miss, needs real-time HTML generation | ar5iv 缓存未命中，需要实时生成 HTML

**Subsequent conversions fast (<1 second) | 后续转换快（<1 秒）**：

- ar5iv has cached the paper's HTML | ar5iv 已缓存该论文的 HTML
- Local Turndown conversion is nearly instant | 本地 Turndown 转换几乎瞬间完成

### Q: How is the converted Markdown quality? | 转换的 Markdown 质量如何？

**A:**

- **ar5iv mode | ar5iv 模式**：
  - Formulas | 公式：✅ Perfect (LaTeX format | LaTeX 格式)
  - Tables | 表格：✅ Good (GFM format | GFM 格式)
  - Images | 图片：✅ External links (ar5iv CDN | ar5iv CDN)
  - Layout | 排版：✅ Structure preserved | 保留结构

---

## 📄 Content Related | 内容相关

### Q: Does the Markdown include images? | Markdown 中包含图片吗？

**A:** Yes. Images exist as external links (pointing to ar5iv CDN), requires internet to view.

**A:** 包含。图片以外链形式存在（指向 ar5iv CDN），需要联网查看。

**Example | 示例：**

```markdown
![Figure 1](https://arxiv.org/html/1706.03762/figure1.png)
```

**Future plans | 未来计划**：Support "bundle download" option (download images together) | 支持"打包下载"选项（图片一起下载）

### Q: How are formulas displayed? | 公式如何显示？

**A:** Formulas are saved in LaTeX format | 公式以 LaTeX 格式保存：

- Inline formulas | 行内公式：`$x = y$`
- Block formulas | 块级公式：`$$E = mc^2$$`

**Supported tools | 支持工具：**

- Obsidian (native support | 原生支持)
- Typora (native support | 原生支持)
- VS Code (needs Markdown Preview Enhanced plugin | 需 Markdown Preview Enhanced 插件)
- Notion (needs manual conversion | 需手动转换)

### Q: What's the table format? | 表格格式是什么？

**A:** GitHub Flavored Markdown (GFM) format | GFM 格式：

```markdown
| Col1 | Col2 | Col3 |
| --- | --- | --- |
| A   | B   | C   |
```

All modern Markdown editors support this. | 所有现代 Markdown 编辑器都支持。

### Q: Does Markdown include metadata? | Markdown 包含元数据吗？

**A:** Yes. File header contains YAML Front Matter | 是的。文件头部包含 YAML Front Matter：

```yaml
---
title: Attention Is All You Need
arxiv_id: 1706.03762
source: ar5iv
converted_at: 2025-12-01T21:18:25+08:00
---
```

Can be disabled in settings. | 可以在设置中禁用此功能。

---

## 🛠️ Technical Issues | 技术问题

### Q: Why doesn't the button appear? | 为什么按钮没有出现？

**A:** Possible reasons | 可能原因：

1. Not on arXiv Abstract page (doesn't show on PDF page) | 不在 arXiv Abstract 页面（PDF 页面不显示）
2. Page not fully loaded (wait a few seconds) | 页面未加载完成（等待几秒）
3. Extension disabled (check `chrome://extensions/`) | 扩展被禁用（检查 `chrome://extensions/`）

**Solutions | 解决方案**：

- Refresh page | 刷新页面
- Confirm extension is enabled | 确认扩展已启用
- Check console errors (F12) | 查看控制台错误（F12）

### Q: Button click has no response? | 点击按钮没反应？

**A:**

1. Open Chrome console (F12) to check errors | 打开 Chrome 控制台（F12）查看错误
2. Check network connection | 检查网络连接
3. Try restarting browser | 尝试重启浏览器
4. Submit Issue on GitHub | 在 GitHub 提交 Issue

### Q: Downloaded filename is garbled? | 下载的文件名乱码？

**A:** Might be browser encoding issue | 可能是浏览器编码问题：

- Chrome: Settings → Advanced → Downloads → Encoding (select UTF-8) | Chrome: 设置 → 高级 → 下载内容 → 编码（选择 UTF-8）
- Check if paper title contains special characters | 检查论文标题是否包含特殊字符

### Q: Can I use it in incognito mode? | 能在无痕模式使用吗？

**A:** Yes, but requires | 可以，但需要：

1. Open `chrome://extensions/` | 打开 `chrome://extensions/`
2. Find arXiv to Markdown | 找到 arXiv to Markdown
3. Click "Details" | 点击"详情"
4. Enable "Allow in incognito" | 开启"在无痕模式下启用"

### Q: Is Firefox supported? | 支持 Firefox 吗？

**A:**

- Currently: Only Chrome/Edge (Chromium-based) | 当前：仅支持 Chrome/Edge（Chromium 内核）
- Planned: Firefox version (using WebExtension API) | 计划中：Firefox 版本（使用 WebExtension API）

---

## 🔒 Privacy & Security | 隐私与安全

### Q: Does the extension collect my data? | 插件会收集我的数据吗？

**A:** **No**. The extension | **不会**。插件：

- ✅ 100% local processing (ar5iv mode) | 100% 本地处理（ar5iv 模式）
- ✅ Sends no data to our servers | 不发送任何数据到我们的服务器
- ✅ All data stored locally encrypted | 所有数据加密存储在本地

### Q: What permissions are required? | 需要哪些权限？

**A:**

- `storage`: Save config and statistics | 保存配置和统计
- `downloads`: Download Markdown files | 下载 Markdown 文件
- `activeTab`: Read current paper page | 读取当前论文页面
- `notifications`: Show conversion results | 显示转换结果
- `host_permissions`: Access arxiv.org, ar5iv.org

All permissions are necessary and not overused. | 所有权限都是必要的，不会过度使用。

---

## 💡 Advanced Usage | 高级用法

### Q: Can I batch convert? | 可以批量转换吗？

**A:**

- Current version: Not supported (need to click one by one) | 当前版本：不支持（需逐个点击）
- Future version: Plan to add batch conversion | 未来版本：计划添加批量转换功能

### Q: Can it auto-convert? | 能自动转换吗？

**A:**

- Can enable "auto-convert" in settings (planned feature) | 可以在设置中开启"自动转换"（计划中的功能）
- Auto-popup conversion prompt when entering paper page | 进入论文页面自动弹出转换提示

### Q: How to integrate with Obsidian? | 如何集成到 Obsidian？

**A:**

1. In Chrome settings: Downloads → Location → Select Obsidian Vault directory | 在 Chrome 设置中：下载内容 → 位置 → 选择 Obsidian Vault 目录
2. Downloaded Markdown appears directly in Obsidian | 下载的 Markdown 会直接出现在 Obsidian 中
3. Can view and edit directly in Obsidian | 在 Obsidian 中可直接查看和编辑

### Q: How to integrate with Notion? | 如何集成到 Notion？

**A:**

1. Download Markdown file | 下载 Markdown 文件
2. Drag and drop to Notion page | 拖拽到 Notion 页面
3. Notion auto-imports (formulas may need manual conversion) | Notion 会自动导入（但公式需要手动转换）

### Q: Does it support custom templates? | 支持自定义模板吗？

**A:**

- Current version: Not supported | 当前版本：不支持
- Future version: Plan to support custom Markdown templates | 未来版本：计划支持自定义 Markdown 模板

---

## 🐛 Troubleshooting | 故障排除

### Q: Extension icon is gray? | 扩展图标是灰色的？

**A:** Possible reasons | 可能原因：

- Not on arXiv page (extension only activates on arXiv) | 不在 arXiv 页面（扩展仅在 arXiv 激活）
- Extension is disabled | 扩展被禁用

### Q: Statistics not updating? | 统计数据不更新？

**A:**

- Check Chrome Storage permissions | 检查 Chrome Storage 权限
- Try clearing and reinstalling extension | 尝试清除并重新安装扩展
- Data stored locally, uninstall will lose it | 数据存储在本地，卸载会丢失

### Q: Can't find downloaded file? | 转换后文件找不到？

**A:**

- Check Chrome download settings (`chrome://settings/downloads`) | 检查 Chrome 下载设置
- Check default download location | 查看默认下载位置
- Check download history (`Ctrl+J`) | 检查下载记录

---

## 🚀 Performance Issues | 性能问题

### Q: Does the extension affect browser performance? | 插件会影响浏览器性能吗？

**A:** Minimal impact | 影响极小：

- **Memory usage | 内存占用**: About 10-20MB (only activates on arXiv pages | 仅在 arXiv 页面激活)
- **CPU usage**: Brief peak during conversion, zero after completion | 转换时短暂峰值，完成后归零
- **Network traffic | 网络流量**:
  - ar5iv mode: About 500KB-2MB (HTML size | HTML 大小)

**Optimization tips | 优化建议**：

- Close other memory-intensive tabs during conversion | 转换时关闭其他占用内存的标签页
- Use "fast mode" to reduce network traffic | 使用"快速模式"减少网络流量
- Clear browser cache to free space | 清理浏览器缓存释放空间

---

## 📞 Getting Help | 获取帮助

### Q: How to report a bug? | 如何报告 Bug？

**A:**

1. Visit [GitHub Issues](https://github.com/Tendo33/arxiv-md/issues)
2. Click "New Issue"
3. Select "Bug Report" template | 选择"Bug Report"模板
4. Provide detailed info | 提供详细信息：
   - Browser version | 浏览器版本
   - Extension version | 扩展版本
   - Reproduction steps | 复现步骤
   - Error screenshots | 错误截图

### Q: How to suggest a feature? | 如何提出功能建议？

**A:**

1. Click "New Issue" on GitHub Issues
2. Select "Feature Request" template | 选择"Feature Request"模板
3. Describe your need and use case | 描述你的需求和使用场景

### Q: How to contribute? | 如何参与贡献？

**A:**

1. Read [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Fork the project repository | Fork 项目仓库
3. Submit Pull Request | 提交 Pull Request

---

## 🎓 Other | 其他

### Q: Is this an official tool? | 这是官方工具吗？

**A:** No. This is an independently developed third-party tool, not affiliated with arXiv.

**A:** 不是。这是独立开发的第三方工具，与 arXiv 官方无关。

### Q: Can it be used commercially? | 可以商用吗？

**A:** Yes. This project uses MIT License, commercial use is allowed.

**A:** 可以。本项目采用 MIT License，允许商用。

### Q: How to support the project? | 如何支持项目？

**A:**

- ⭐ Star the project on GitHub | 在 GitHub 给项目点 Star
- 📢 Share with colleagues and friends | 分享给同事和朋友
- 💰 Sponsor the developer (GitHub Sponsors) | 赞助开发者
- 🤝 Contribute code or documentation | 贡献代码或文档

---

**More questions?** Ask on [GitHub Discussions](https://github.com/Tendo33/arxiv-md/discussions)!

**还有其他问题？** 请在 [GitHub Discussions](https://github.com/Tendo33/arxiv-md/discussions) 提问！
