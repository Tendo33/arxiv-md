# Architecture Design | 架构设计文档

## Overview | 概述

arXiv to Markdown uses a **two-tier intelligent fallback architecture** to achieve optimal balance between speed, quality, and availability.

arXiv to Markdown 采用**多层智能降级架构**（Multi-tier Fallback），在速度、质量和可用性之间达到最佳平衡。

---

## Core Architecture | 核心架构

```
┌─────────────────────────────────────────────────┐
│           Chrome Extension (Manifest V3)         │
└─────────────────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
┌───────────┐   ┌────────────┐   ┌──────────┐
│  Content  │   │ Background │   │   UI     │
│  Script   │   │   Worker   │   │ (Popup)  │
└───────────┘   └────────────┘   └──────────┘
       │               │               │
       └───────────────┼───────────────┘
                       ▼
            ┌──────────────────────┐
            │   Core Converter     │
            │  (Main Controller)   │
            └──────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
┌────────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────┐
│  ar5iv     │  │   ar5iv     │  │  MinerU  │  │   PDF    │
│ Converter  │  │   Check     │  │   API    │  │ Fallback │
│ (Tier 1)   │  │  (HEAD req) │  │ (Tier 2) │  │ (Tier 3) │
└────────────┘  └─────────────┘  └──────────┘  └──────────┘
```

---

## Module Design | 模块设计

### 1. Content Script (`src/content/`)

**Responsibilities | 职责：**

- Inject "Save as Markdown" button to arXiv pages | 注入"保存为 Markdown"按钮到 arXiv 页面
- Extract paper metadata (title, authors, ID) | 提取论文元数据（标题、作者、ID）
- Listen to user interactions, trigger conversion | 监听用户交互，触发转换
- Display progress and result feedback | 显示进度和结果反馈

**Technical Highlights | 技术亮点：**

- DOM manipulation and CSS injection | DOM 操作和 CSS 注入
- Message Passing with Background | 与 Background 通信
- Toast notification system | Toast 通知系统

### 2. Background Worker (`src/background/`)

**Responsibilities | 职责：**

- Receive conversion requests | 接收转换请求
- Coordinate Core Converter | 协调 Core Converter
- Manage extension lifecycle | 管理扩展生命周期
- Handle shortcuts and notifications | 处理快捷键和通知

**Technical Highlights | 技术亮点：**

- Service Worker (Manifest V3)
- Async message handling | 异步消息处理
- Keep-alive mechanism | Keep-alive 机制

### 3. Core Converter (`src/core/converter/`)

#### 3.1 ar5iv Converter (Tier 1)

**Conversion Flow | 转换流程：**

```
ar5iv URL → fetch HTML → Readability cleanup → Turndown convert → Markdown
ar5iv URL → fetch HTML → Readability 清洗 → Turndown 转换 → Markdown
```

**Custom Rules | 自定义规则：**

- LaTeX formulas: Extract `<annotation encoding="application/x-tex">` | LaTeX 公式：提取
- Images: Preserve ar5iv CDN links | 图片：保留 ar5iv CDN 链接
- Tables: Enable GFM plugin | 表格：启用 GFM 插件
- Citations: Extract `.ltx_cite` nodes | 引用：提取 `.ltx_cite` 节点

#### 3.2 Main Controller (`index.js`)

**Decision Logic | 决策逻辑：**

```javascript
try {
  if (useMinerU) return await mineruConverter.convert(); // Tier 2
  return await ar5ivConverter.convert(); // Tier 1
} catch {
  return downloadPDF(); // Tier 3 (Fallback)
}
```

### 4. Metadata Extractor (`src/core/metadata-extractor.js`)

**Extraction Strategy | 提取策略：**

1. **Priority | 优先：** Extract from Abstract page DOM | 从 Abstract 页面 DOM 提取
2. **Backup | 备用：** Call arXiv export API | 调用 arXiv export API
3. **Fallback | 兜底：** Generate minimal metadata from arXiv ID | 使用 arXiv ID 生成最小元数据

**Extracted Fields | 提取字段：**

- `arxivId` - arXiv identifier | arXiv 标识符
- `title` - Paper title | 论文标题
- `authors` - Author list | 作者列表
- `abstract` - Abstract | 摘要
- `year` - Publication year | 发表年份
- `subjects` - Category tags | 分类标签
- `pdfUrl` - PDF download link | PDF 下载链接

### 5. UI Layer (`src/ui/`)

#### Popup (`popup/`)

- Status display (conversion mode, Token status) | 状态展示（转换模式、Token 状态）
- Statistics (total conversions, success rate) | 统计数据（总转换数、成功率）
- Quick actions (one-click convert current paper) | 快捷操作（一键转换当前论文）

#### Settings (`settings/`)

- Conversion mode selection (card-style selector) | 转换模式选择（卡片式选择器）
- Advanced options (notifications, metadata, etc.) | 高级选项（通知、元数据等）
- Statistics display and reset | 统计数据展示和重置

### 6. Utils Layer (`src/utils/`)

#### Logger (`logger.js`)
- Leveled logging (ERROR, WARN, INFO, DEBUG) | 分级日志
- Timestamps and namespaces | 时间戳和命名空间
- Dev/prod environment distinction | 开发/生产环境区分

### 7. Task Manager (MinerU)
- **Asynchronous Task Queue**: Handles long-running PDF parsing tasks.
- **Background Processing**: Runs in Service Worker to avoid blocking UI.
- **State Management**: Tracks task status (pending, processing, completed) to prevent duplicates.

#### Storage (`storage.js`)

- Chrome Storage API wrapper | Chrome Storage API 封装
- Business-specific methods (`getStatistics`, etc.) | 业务特定方法
- Type safety and error handling | 类型安全和错误处理

#### Helpers (`helpers.js`)

- arXiv ID extraction | arXiv ID 提取
- Filename cleanup and generation | 文件名清理和生成
- Download management | 下载管理
- Notification creation | 通知创建
- Time/byte formatting | 时间/字节格式化

---

## Environment Adaptation | 环境适配层

### DOM Parsing Strategy | DOM 解析策略

**Challenge**: Chrome Extension Manifest V3's Service Worker environment cannot access browser DOM API.

**挑战**：Chrome Extension Manifest V3 的 Service Worker 环境无法访问浏览器 DOM API。

**Solution | 解决方案**：

- **Content Script** (browser environment | 浏览器环境):
  - Use native DOM API directly | 直接使用原生 DOM API
  - Execute Turndown conversion (CONVERT_HTML_TO_MARKDOWN) | 执行 Turndown 转换
  - Advantage: Best performance, full compatibility | 优势：性能最佳，完全兼容

- **Service Worker** (background environment | 后台环境):
  - Use linkedom for DOM simulation | 使用 linkedom 提供 DOM 模拟
  - Lightweight (~200KB), designed for Node.js/Worker | 轻量级，专为 Node.js/Worker 设计
  - Supports basic DOM API needed by Readability and Turndown | 支持 Readability 和 Turndown 所需的基础 DOM API

**Why linkedom?**

| Solution | Size | Service Worker Compatible | Performance | Decision |
|----------|------|---------------------------|-------------|----------|
| jsdom | ~5MB | Partial | Slower | ❌ Too large |
| linkedom | ~200KB | ✅ Full | Fast | ✅ Best choice |
| happy-dom | ~300KB | ⚠️ Partial | Fast | ⚠️ Incomplete API |

### Conversion Flow Division | 转换流程分工

```
Content Script (browser environment | 浏览器环境):
  ✓ Extract page metadata | 提取页面元数据
  ✓ Execute HTML → Markdown conversion (Turndown) | 执行 HTML → Markdown 转换
  ✓ Handle file download | 处理文件下载

Service Worker (background environment | 后台环境):
  ✓ Coordinate conversion strategy (two-tier fallback) | 协调转换策略（两层降级）
  ✓ Call external APIs (ar5iv) | 调用外部 API
  ✓ Manage storage and statistics | 管理存储和统计
```

---

## Data Flow | 数据流

### Complete Conversion Data Flow | 转换流程完整数据流

```
User Click
    ↓
Content Script
    ↓ [Message: CONVERT_PAPER]
Background Worker
    ↓ [Call: converter.convert()]
Main Converter
    ↓ [Strategy Decision | 策略决策]
ar5iv Converter / PDF Fallback
    ↓ [Progress Callbacks]
Background Worker
    ↓ [Message: CONVERSION_PROGRESS]
Content Script
    ↓ [Update UI]
User Feedback (Toast/Notification)
    ↓
Chrome Downloads API
    ↓
File Saved
```

---

## Error Handling Strategy | 错误处理策略

### Multi-layer Fault Tolerance | 多层容错

1. **ar5iv fails** → Auto switch to PDF download | 自动切换到 PDF 下载
2. **Network error** → Retry mechanism (max 3 times) | 重试机制（最多 3 次）
3. **API error** → User-friendly prompt | 友好提示用户

### Error Classification | 错误分类

- **User-facing**: Toast + desktop notification
- **Developer**: Console logs (logger)
- **Analytics**: Statistics update | 统计数据更新

---

## Performance Optimization | 性能优化

### 1. Parallel Processing | 并行处理

- ar5iv availability check (HEAD request) parallel with metadata extraction | ar5iv 可用性检查与元数据提取并行
- Webpack code splitting (lazy load by module) | Webpack 代码分割（按模块懒加载）

### 2. Caching Strategy | 缓存策略

- Chrome Storage caches configuration | Chrome Storage 缓存配置
- ar5iv HTML could be cached (not implemented) | ar5iv HTML 可以考虑缓存（未实现）

### 3. Resource Optimization | 资源优化

- Turndown/Readability use singleton pattern | Turndown/Readability 使用单例模式
- Avoid repeated DOM queries | 避免重复的 DOM 查询

### 4. Lightweight Dependencies | 轻量级依赖

- linkedom (200KB) replaces jsdom (5MB), 96% size reduction | linkedom 替代 jsdom，减少 96% 体积
- Service Worker startup time from ~500ms to ~50ms | Service Worker 启动时间从 ~500ms 降至 ~50ms
- Memory usage reduced by ~80% | 内存占用减少约 80%

---

## Security | 安全性

### 1. Input Validation | 输入验证

- arXiv ID format validation (regex) | arXiv ID 格式验证（正则表达式）
- Filename cleanup (remove illegal characters) | 文件名清理（移除非法字符）
- URL validation (prevent XSS) | URL 验证（防止 XSS）

### 2. API Security | API 安全

- HTTPS-only requests | 仅 HTTPS 请求
- CORS handling | CORS 处理

### 3. Permission Minimization | 权限最小化

- Only request necessary `host_permissions` | 仅请求必要的 `host_permissions`
- Content Security Policy (Manifest V3)

---

## Extensibility | 可扩展性

### Plugin-based Design | 插件化设计

All converters implement a unified interface | 所有转换器实现统一接口：

```javascript
interface Converter {
  convert(paperInfo): Promise<{markdown, metadata}>;
  checkAvailability?(arxivId): Promise<boolean>;
}
```

**Adding a new converter only requires | 新增转换器只需：**

1. Implement the interface | 实现接口
2. Register in Main Converter | 在 Main Converter 中注册
3. Add to configuration options | 添加到配置选项

### Configuration-driven | 配置驱动

- All constants centralized in `src/config/constants.js` | 所有常量集中在 `src/config/constants.js`
- User config stored in Chrome Storage | 用户配置存储在 Chrome Storage
- Easy to add new options | 易于添加新选项

---

## Future Architecture Evolution | 未来架构演进

### 1. Backend Service (Optional) | 后端服务（可选）

```
Chrome Extension → Self-hosted API Service → Various Tools
Chrome Extension → 自建 API 服务 → 各种工具
```

**Advantages | 优势：**

- Unified API key management | 统一管理 API Keys
- Batch processing queue | 批量处理队列
- Cache popular papers | 缓存热门论文

### 2. Multi-browser Support | 多浏览器支持

- Use WebExtension Polyfill | 使用 WebExtension Polyfill
- Abstract browser-specific APIs | 抽象浏览器特定 API

### 3. Offline Mode | 离线模式

- IndexedDB cache papers | IndexedDB 缓存论文
- Service Worker offline strategy | Service Worker 离线策略

---

**Last Updated**: 2026-01-04  
**Version**: 1.1.0
