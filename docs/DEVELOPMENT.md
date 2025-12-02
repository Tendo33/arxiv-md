# 开发指南

本文档面向希望为 arXiv to Markdown 做贡献或基于此项目进行二次开发的开发者。

## 🚀 快速开始

### 环境要求

- Node.js >= 16.x
- npm >= 8.x
- Chrome/Edge 浏览器

### 安装和运行

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/arxiv-md.git
cd arxiv-md

# 2. 安装依赖
npm install

# 3. 启动开发模式（自动编译）
npm run dev

# 4. 在 Chrome 中加载扩展
# - 打开 chrome://extensions/
# - 开启"开发者模式"
# - 点击"加载已解压的扩展程序"
# - 选择项目的 dist 目录
```

### 开发工作流

```bash
# 监听文件变化（推荐在开发时保持运行）
npm run dev

# 代码检查
npm run lint

# 构建生产版本
npm run build

# 打包成 ZIP（用于发布）
npm run package
```

## 📂 项目结构理解

### 核心模块关系

```
User Interaction (Content Script)
    ↓
Message Passing
    ↓
Background Worker
    ↓
Main Converter (决策中心)
    ↓
├─→ ar5iv Converter (Tier 1)
├─→ MinerU Client (Tier 2)
└─→ PDF Fallback (Tier 3)
```

### 添加新功能的步骤

#### 1. 添加新的转换器（示例）

```javascript
// src/core/converter/new-converter.js
import logger from "@utils/logger";

class NewConverter {
  async convert(paperInfo) {
    logger.info("Starting new conversion:", paperInfo.arxivId);

    try {
      // 实现转换逻辑
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
    // 具体实现
  }
}

export default new NewConverter();
```

#### 2. 集成到主转换器

```javascript
// src/core/converter/index.js
import newConverter from "./new-converter";

// 在 _convertWithTieredStrategy 方法中添加新层级
// ... existing code ...

// === New Tier: 尝试新转换器 ===
if (someCondition) {
  try {
    return await newConverter.convert(paperInfo);
  } catch (error) {
    logger.warn("New converter failed, continuing...");
  }
}
```

#### 3. 更新配置

```javascript
// src/config/constants.js
export const CONVERSION_TIER = {
  AR5IV_LOCAL: "ar5iv_local",
  MINERU_API: "mineru_api",
  NEW_TIER: "new_tier", // 添加新类型
  PDF_FALLBACK: "pdf_fallback",
};
```

## 🔧 调试技巧

### Chrome DevTools 调试

#### 1. Background Service Worker

```
chrome://extensions/ → 扩展详情 → "Service Worker" → 点击 "查看视图"
```

#### 2. Content Script

```
在 arXiv 页面 → F12 → Console
```

#### 3. Popup

```
右键点击扩展图标 → "检查弹出内容"
```

### 日志系统使用

```javascript
import logger from "@utils/logger";

// 不同级别的日志
logger.error("Critical error:", error);
logger.warn("Warning message");
logger.info("Info message");
logger.debug("Debug details");

// 设置日志级别（开发环境自动为 DEBUG）
logger.setLevel(LOG_LEVELS.DEBUG);
```

### 常见问题排查

#### 问题 1: Service Worker 不响应

```javascript
// 检查 Service Worker 是否活跃
chrome.runtime.sendMessage({ type: "PING" }, (response) => {
  console.log("Service Worker alive:", response);
});
```

#### 问题 2: Content Script 未注入

- 检查 `manifest.json` 中的 `matches` 规则
- 确认页面 URL 匹配
- 尝试刷新页面

#### 问题 3: 模块导入错误

- 确认 Webpack 配置中的 `resolve.alias`
- 检查相对路径是否正确
- 重启 `npm run dev`

## 🧪 测试

### 手动测试清单

```
✅ Tier 1 (ar5iv)
  □ 访问常见论文（如 Attention Is All You Need）
  □ 检查 Markdown 格式是否正确
  □ 验证公式是否正确转换
  □ 检查图片链接是否有效

✅ Tier 2 (MinerU)
  □ 找一篇 ar5iv 不支持的论文
  □ 配置 MinerU Token
  □ 验证转换质量
  □ 检查进度指示器

✅ Tier 3 (PDF Fallback)
  □ 移除 MinerU Token
  □ 测试 ar5iv 失败场景
  □ 验证 PDF 文件名是否有意义

✅ UI
  □ Popup 显示正常
  □ Settings 页面配置生效
  □ Toast 通知显示
  □ 统计数据更新
```

### 自动化测试（未来计划）

```javascript
// 示例：单元测试（使用 Jest）
import { extractArxivId } from "@utils/helpers";

describe("extractArxivId", () => {
  test("should extract ID from URL", () => {
    expect(extractArxivId("https://arxiv.org/abs/1706.03762")).toBe(
      "1706.03762",
    );
  });
});
```

## 🎨 代码风格指南

### JavaScript 规范

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

### 注释规范

```javascript
// {{RIPER-7 Action}}
// Role: LD | Task_ID: #123 | Time: 2025-12-01T21:18:25+08:00
// Logic: 简要描述此文件的职责和核心逻辑
// Principle: SOLID-X (具体原则)

/**
 * 函数说明
 * @param {type} paramName - 参数说明
 * @returns {type} 返回值说明
 */
function example(paramName) {
  // 实现
}
```

### 命名约定

```javascript
// 文件名：kebab-case
// ar5iv-converter.js
// metadata-extractor.js

// 类名：PascalCase
class MetadataExtractor {}

// 函数/变量：camelCase
const userName = "John";
function getUserData() {}

// 常量：UPPER_SNAKE_CASE
const API_BASE_URL = "https://api.example.com";
const MAX_RETRY_COUNT = 3;
```

## 🔒 安全注意事项

### 1. 用户输入验证

```javascript
// 始终验证用户输入
function sanitizeInput(input) {
  return input
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .substring(0, 200);
}
```

### 2. API Token 处理

```javascript
// ✅ 使用 Chrome Storage（加密）
await storage.setMinerUToken(token);

// ❌ 不要存储在 localStorage
localStorage.setItem("token", token); // 危险！
```

### 3. XSS 防护

```javascript
// ✅ 使用 textContent
element.textContent = userInput;

// ❌ 不要使用 innerHTML 处理用户输入
element.innerHTML = userInput; // 危险！
```

## 📊 性能优化

### 1. 避免不必要的转换

```javascript
// ✅ 先检查 ar5iv 可用性
const available = await ar5ivConverter.checkAvailability(arxivId);
if (!available) {
  // 直接跳到 Tier 2
}

// ❌ 直接尝试转换
try {
  await ar5ivConverter.convert(arxivId);
} catch {}
```

### 2. 使用单例模式

```javascript
// ✅ 复用实例
class Converter {
  constructor() {
    this.turndownService = this._initTurndown();
  }
}
export default new Converter();

// ❌ 每次创建新实例
export function convert() {
  const service = new TurndownService(); // 浪费
}
```

## 🚢 发布流程

### 1. 版本更新

```bash
# 更新版本号（自动更新 package.json）
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0

# 手动同步到 src/manifest.json
```

### 2. 构建和打包

```bash
# 生产构建
npm run build

# 打包 ZIP
npm run package

# 输出文件: build/arxiv-md-vX.X.X.zip
```

### 3. Chrome Web Store 发布

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 上传 ZIP 文件
3. 填写更新说明（参考 CHANGELOG.md）
4. 提交审核

### 4. GitHub Release

```bash
git tag v1.0.0
git push origin v1.0.0

# 在 GitHub 创建 Release，附上 CHANGELOG
```

## 🤝 贡献工作流

1. **Fork** 仓库到你的账号
2. **Clone** 到本地
3. **创建分支**: `git checkout -b feature/my-feature`
4. **开发并测试**
5. **提交**: `git commit -m "feat: add amazing feature"`
6. **推送**: `git push origin feature/my-feature`
7. **创建 Pull Request**

## 📚 推荐阅读

- [Chrome Extension 官方文档](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 迁移指南](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Turndown 文档](https://github.com/mixmark-io/turndown)
- [Webpack 配置](https://webpack.js.org/configuration/)

## 🆘 获取帮助

- **GitHub Issues**: 报告 Bug 或功能请求
- **Discussions**: 技术讨论和问答
- **Email**: your.email@example.com

---

Happy Coding! 🎉
