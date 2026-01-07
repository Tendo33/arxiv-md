# Development Guide | 开发指南

This document is for developers who want to contribute to arXiv to Markdown or build upon this project.

本文档面向希望为 arXiv to Markdown 做贡献或基于此项目进行二次开发的开发者。

---

## 🚀 Quick Start | 快速开始

### Requirements | 环境要求

- Node.js >= 16.x
- npm >= 8.x
- Chrome/Edge browser | Chrome/Edge 浏览器

### Installation and Running | 安装和运行

```bash
# 1. Clone repository | 克隆仓库
git clone https://github.com/Tendo33/arxiv-md.git
cd arxiv-md

# 2. Install dependencies | 安装依赖
npm install

# 3. Start development mode (auto-compile) | 启动开发模式（自动编译）
npm run dev

# 4. Load extension in Chrome | 在 Chrome 中加载扩展
# - Open chrome://extensions/ | 打开 chrome://extensions/
# - Enable "Developer mode" | 开启"开发者模式"
# - Click "Load unpacked" | 点击"加载已解压的扩展程序"
# - Select the dist directory | 选择项目的 dist 目录
```

### Development Workflow | 开发工作流

```bash
# Watch file changes (recommended during development)
# 监听文件变化（推荐在开发时保持运行）
npm run dev

# Code linting | 代码检查
npm run lint

# Production build | 构建生产版本
npm run build

# Package as ZIP (for release) | 打包成 ZIP（用于发布）
npm run package
```

---

## 📂 Project Structure | 项目结构理解

### Core Module Relationships | 核心模块关系

```
User Interaction (Content Script)
    ↓
Message Passing
    ↓
Background Worker
    ↓
Main Converter (Decision Center | 决策中心)
    ↓
├─→ ar5iv Converter (Tier 1)
├─→ MinerU Converter (Tier 2)
└─→ PDF Fallback (Tier 3)
```

### Adding New Features | 添加新功能的步骤

#### 1. Add a New Converter (Example) | 添加新的转换器（示例）

```javascript
// src/core/converter/new-converter.js
import logger from "@utils/logger";

class NewConverter {
  async convert(paperInfo) {
    logger.info("Starting new conversion:", paperInfo.arxivId);

    try {
      // Implement conversion logic | 实现转换逻辑
      const markdown = await this.doConvert(paperInfo);

      return {
        markdown: markdown,
        metadata: {
          arxivId: paperInfo.arxivId,
          source: "new_source",
        },
      };
    } catch (error) {
      logger.error("New converter failed:", error);
      throw error;
    }
  }

  async doConvert(paperInfo) {
    // Specific implementation | 具体实现
  }
}

export default new NewConverter();
```

#### 2. Integrate into Main Converter | 集成到主转换器

```javascript
// src/core/converter/index.js
import newConverter from "./new-converter";

// Add new tier in _convertWithTieredStrategy method
// 在 _convertWithTieredStrategy 方法中添加新层级
// ... existing code ...

// === New Tier: Try new converter ===
if (someCondition) {
  try {
    return await newConverter.convert(paperInfo);
  } catch (error) {
    logger.warn("New converter failed, continuing...");
  }
}
```

#### 3. Update Configuration | 更新配置

```javascript
// src/config/constants.js
export const CONVERSION_TIER = {
  AR5IV_LOCAL: "ar5iv_local",
  MINERU_API: "mineru_api", // MinerU Support
  PDF_FALLBACK: "pdf_fallback",
};
```

---

## 🔧 Debugging Tips | 调试技巧

### Chrome DevTools Debugging | Chrome DevTools 调试

#### 1. Background Service Worker

```
chrome://extensions/ → Extension details → "Service Worker" → Click "Inspect"
chrome://extensions/ → 扩展详情 → "Service Worker" → 点击 "查看视图"
```

#### 2. Content Script

```
On arXiv page → F12 → Console
在 arXiv 页面 → F12 → Console
```

#### 3. Popup

```
Right-click extension icon → "Inspect popup"
右键点击扩展图标 → "检查弹出内容"
```

### Logger System Usage | 日志系统使用

```javascript
import logger from "@utils/logger";

// Different log levels | 不同级别的日志
logger.error("Critical error:", error);
logger.warn("Warning message");
logger.info("Info message");
logger.debug("Debug details");

// Set log level (auto DEBUG in development) | 设置日志级别（开发环境自动为 DEBUG）
logger.setLevel(LOG_LEVELS.DEBUG);
```

### Common Issue Troubleshooting | 常见问题排查

#### Issue 1: Service Worker Not Responding | 问题 1: Service Worker 不响应

```javascript
// Check if Service Worker is alive | 检查 Service Worker 是否活跃
chrome.runtime.sendMessage({ type: "PING" }, (response) => {
  console.log("Service Worker alive:", response);
});
```

#### Issue 2: Content Script Not Injected | 问题 2: Content Script 未注入

- Check `matches` rules in `manifest.json` | 检查 `manifest.json` 中的 `matches` 规则
- Confirm page URL matches | 确认页面 URL 匹配
- Try refreshing the page | 尝试刷新页面

#### Issue 3: Module Import Errors | 问题 3: 模块导入错误

- Confirm `resolve.alias` in Webpack config | 确认 Webpack 配置中的 `resolve.alias`
- Check relative paths | 检查相对路径是否正确
- Restart `npm run dev` | 重启 `npm run dev`

#### Issue 4: Test ar5iv Unavailable Scenario | 问题 4: 测试 ar5iv 不可用场景

Manually simulate ar5iv failure to test fallback logic:

手动模拟 ar5iv 失败，测试降级逻辑：

```javascript
// Temporarily add in src/core/converter/ar5iv-converter.js
// 在 src/core/converter/ar5iv-converter.js 中临时添加
async checkAvailability(arxivId) {
  // Force return false to test fallback | 强制返回 false 测试降级
  return false;
}
```

#### Issue 5: Service Worker DOM Limitations | 问题 5: Service Worker 的 DOM 限制

**Common Error | 常见错误**:

```javascript
// ❌ Using DOM API directly in background/index.js
// ❌ 在 background/index.js 中直接使用 DOM API
const div = document.createElement("div"); // Error: document is not defined
```

**Correct Approach | 正确做法**:

```javascript
// ✅ Use linkedom | 使用 linkedom
import { parseHTML } from "linkedom";
const { document } = parseHTML("<div></div>");
```

Or delegate DOM operations to Content Script | 或者将 DOM 操作委托给 Content Script：

```javascript
// ✅ Send message to Content Script | 发送消息给 Content Script
chrome.tabs.sendMessage(tabId, {
  type: "CONVERT_HTML_TO_MARKDOWN",
  data: { html: rawHtml },
});
```

---

## 🧪 Testing | 测试

### Manual Testing Checklist | 手动测试清单

```
✅ Tier 1 (ar5iv)
  □ Visit common papers (e.g., Attention Is All You Need)
    访问常见论文（如 Attention Is All You Need）
  □ Check Markdown format is correct | 检查 Markdown 格式是否正确
  □ Verify formulas convert correctly | 验证公式是否正确转换
  □ Check image links work | 检查图片链接是否有效

✅ Tier 2 (PDF Fallback)
  □ Find a paper ar5iv doesn't support | 找一篇 ar5iv 不支持的论文
  □ Verify PDF filename is meaningful | 验证 PDF 文件名是否有意义

✅ UI
  □ Popup displays correctly | Popup 显示正常
  □ Settings page config takes effect | Settings 页面配置生效
  □ Toast notifications display | Toast 通知显示
  □ Statistics update | 统计数据更新
```

### Automated Testing (Future Plans) | 自动化测试（未来计划）

```javascript
// Example: Unit test (using Jest) | 示例：单元测试（使用 Jest）
import { extractArxivId } from "@utils/helpers";

describe("extractArxivId", () => {
  test("should extract ID from URL", () => {
    expect(extractArxivId("https://arxiv.org/abs/1706.03762")).toBe(
      "1706.03762"
    );
  });
});
```

---

## 🎨 Code Style Guide | 代码风格指南

### JavaScript Standards | JavaScript 规范

```javascript
// ✅ Good
async function fetchData() {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    logger.error("Fetch failed:", error);
    throw error;
  }
}

// ❌ Bad
function fetchData() {
  return fetch(url)
    .then((r) => r.json())
    .catch((e) => console.log(e));
}
```

### Comment Standards | 注释规范

```javascript
/**
 * Function description | 函数说明
 * @param {type} paramName - Parameter description | 参数说明
 * @returns {type} Return value description | 返回值说明
 */
function example(paramName) {
  // Implementation | 实现
}
```

### Naming Conventions | 命名约定

```javascript
// Filenames: kebab-case | 文件名：kebab-case
// ar5iv-converter.js
// metadata-extractor.js

// Class names: PascalCase | 类名：PascalCase
class MetadataExtractor {}

// Functions/variables: camelCase | 函数/变量：camelCase
const userName = "John";
function getUserData() {}

// Constants: UPPER_SNAKE_CASE | 常量：UPPER_SNAKE_CASE
const API_BASE_URL = "https://api.example.com";
const MAX_RETRY_COUNT = 3;
```

---

## 🔒 Security Considerations | 安全注意事项

### 1. Input Validation | 用户输入验证

```javascript
// Always validate user input | 始终验证用户输入
function sanitizeInput(input) {
  return input
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .substring(0, 200);
}
```

### 2. XSS Prevention | XSS 防护

```javascript
// ✅ Use textContent | 使用 textContent
element.textContent = userInput;

// ❌ Don't use innerHTML with user input | 不要使用 innerHTML 处理用户输入
element.innerHTML = userInput; // Dangerous! | 危险！
```

---

## 📊 Performance Optimization | 性能优化

### 1. Avoid Unnecessary Conversions | 避免不必要的转换

```javascript
// ✅ Check ar5iv availability first | 先检查 ar5iv 可用性
const available = await ar5ivConverter.checkAvailability(arxivId);
if (!available) {
  // Skip directly to Tier 2 | 直接跳到 Tier 2
}

// ❌ Try conversion directly | 直接尝试转换
try {
  await ar5ivConverter.convert(arxivId);
} catch {}
```

### 2. Use Singleton Pattern | 使用单例模式

```javascript
// ✅ Reuse instance | 复用实例
class Converter {
  constructor() {
    this.turndownService = this._initTurndown();
  }
}
export default new Converter();

// ❌ Create new instance each time | 每次创建新实例
export function convert() {
  const service = new TurndownService(); // Wasteful | 浪费
}
```

---

## 🚢 Release Process | 发布流程

### 1. Version Update | 版本更新

```bash
# Update version number (auto-updates package.json)
# 更新版本号（自动更新 package.json）
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0

# Manually sync to src/manifest.json | 手动同步到 src/manifest.json
```

### 2. Build and Package | 构建和打包

```bash
# Production build | 生产构建
npm run build

# Package ZIP | 打包 ZIP
npm run package

# Output file | 输出文件: build/arxiv-md-vX.X.X.zip
```

### 3. Chrome Web Store Release | Chrome Web Store 发布

1. Visit [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Upload ZIP file | 上传 ZIP 文件
3. Fill in update notes (refer to CHANGELOG.md) | 填写更新说明（参考 CHANGELOG.md）
4. Submit for review | 提交审核

### 4. GitHub Release

```bash
git tag v1.0.0
git push origin v1.0.0

# Create Release on GitHub, attach CHANGELOG
# 在 GitHub 创建 Release，附上 CHANGELOG
```

---

## 🤝 Contribution Workflow | 贡献工作流

1. **Fork** the repository to your account | Fork 仓库到你的账号
2. **Clone** locally | Clone 到本地
3. **Create branch**: `git checkout -b feature/my-feature` | 创建分支
4. **Develop and test** | 开发并测试
5. **Commit**: `git commit -m "feat: add amazing feature"` | 提交
6. **Push**: `git push origin feature/my-feature` | 推送
7. **Create Pull Request** | 创建 Pull Request

---

## ⚠️ Common Development Pitfalls | 常见开发陷阱

### 1. Service Worker Lifecycle | Service Worker 生命周期

**Problem**: Service Worker may be stopped at any time, causing state loss.

**问题**：Service Worker 可能随时被停用，导致状态丢失。

**Solution | 解决**:

- Don't rely on global variables for state | 不要依赖全局变量存储状态
- Use `chrome.storage` to persist critical data | 使用 `chrome.storage` 持久化关键数据
- Listen to `chrome.runtime.onStartup` to restore state | 监听 `chrome.runtime.onStartup` 恢复状态

### 2. Content Script Injection Timing | Content Script 注入时机

**Problem**: DOM may not be complete when page loads, causing button injection to fail.

**问题**：页面加载时 DOM 可能未完成，导致按钮注入失败。

**Solution | 解决**:

- Use `run_at: "document_end"` (manifest.json)
- Add MutationObserver to watch DOM changes | 添加 MutationObserver 监听 DOM 变化
- Provide manual retry button | 提供手动重试按钮

### 3. CORS Restrictions | CORS 限制

**Problem**: fetch in Content Script is subject to page CORS restrictions.

**问题**：Content Script 中的 fetch 受页面 CORS 限制。

**Solution | 解决**:

- Make cross-origin requests in Background Worker | 在 Background Worker 中发起跨域请求
- Use message passing to forward data | 使用消息传递转发数据
- Configure `host_permissions` (manifest.json)

---

## 📚 Recommended Reading | 推荐阅读

- [Chrome Extension Official Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Turndown Documentation](https://github.com/mixmark-io/turndown)
- [Webpack Configuration](https://webpack.js.org/configuration/)

---

## 🆘 Getting Help | 获取帮助

- **GitHub Issues**: Report bugs or feature requests | 报告 Bug 或功能请求
- **Discussions**: Technical discussions and Q&A | 技术讨论和问答

---

Happy Coding! 🎉
