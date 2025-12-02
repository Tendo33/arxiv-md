# 架构设计文档

## 概述

arXiv to Markdown 采用**三层智能降级架构**，在速度、质量和可用性之间达到最佳平衡。

## 核心架构

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
┌────────────┐  ┌─────────────┐  ┌──────────┐
│  ar5iv     │  │   MinerU    │  │   PDF    │
│ Converter  │  │   Client    │  │ Fallback │
│ (Tier 1)   │  │  (Tier 2)   │  │ (Tier 3) │
└────────────┘  └─────────────┘  └──────────┘
```

## 模块设计

### 1. Content Script (`src/content/`)

**职责：**

- 注入"保存为 Markdown"按钮到 arXiv 页面
- 提取论文元数据（标题、作者、ID）
- 监听用户交互，触发转换
- 显示进度和结果反馈

**技术亮点：**

- DOM 操作和 CSS 注入
- Message Passing 与 Background 通信
- Toast 通知系统

### 2. Background Worker (`src/background/`)

**职责：**

- 接收转换请求
- 协调 Core Converter
- 管理扩展生命周期
- 处理快捷键和通知

**技术亮点：**

- Service Worker (Manifest V3)
- 异步消息处理
- Keep-alive 机制

### 3. Core Converter (`src/core/converter/`)

#### 3.1 ar5iv Converter (Tier 1)

**转换流程：**

```
ar5iv URL → fetch HTML → Readability 清洗 → Turndown 转换 → Markdown
```

**自定义规则：**

- LaTeX 公式：提取 `<annotation encoding="application/x-tex">`
- 图片：保留 ar5iv CDN 链接
- 表格：启用 GFM 插件
- 引用：提取 `.ltx_cite` 节点

#### 3.2 MinerU Client (Tier 2)

**API 调用流程：**

```
PDF URL → 下载 Blob → POST /task → 获取 task_id → 轮询 /result → Markdown
```

**进度反馈：**

- 下载中：0-20%
- 上传中：20-40%
- 解析中：40-100%（根据 API 返回进度）

#### 3.3 主控制器 (`index.js`)

**决策逻辑：**

```javascript
if (mode === ALWAYS_MINERU && hasMinerUToken) {
  return convertWithMinerU();
}

try {
  return await ar5ivConverter.convert(); // Tier 1
} catch {
  if (mode === QUALITY && hasMinerUToken) {
    return await mineruClient.convert(); // Tier 2
  }
  return downloadPDF(); // Tier 3
}
```

### 4. Metadata Extractor (`src/core/metadata-extractor.js`)

**提取策略：**

1. **优先：** 从 Abstract 页面 DOM 提取
2. **备用：** 调用 arXiv export API
3. **兜底：** 使用 arXiv ID 生成最小元数据

**提取字段：**

- `arxivId` - arXiv 标识符
- `title` - 论文标题
- `authors` - 作者列表
- `abstract` - 摘要
- `year` - 发表年份
- `subjects` - 分类标签
- `pdfUrl` - PDF 下载链接

### 5. UI Layer (`src/ui/`)

#### Popup (`popup/`)

- 状态展示（转换模式、Token 状态）
- 统计数据（总转换数、成功率）
- 快捷操作（一键转换当前论文）

#### Settings (`settings/`)

- 转换模式选择（卡片式选择器）
- MinerU Token 配置（密码输入 + 可见性切换）
- 高级选项（通知、元数据等）
- 统计数据展示和重置

### 6. Utils Layer (`src/utils/`)

#### Logger (`logger.js`)

- 分级日志（ERROR, WARN, INFO, DEBUG）
- 时间戳和命名空间
- 开发/生产环境区分

#### Storage (`storage.js`)

- Chrome Storage API 封装
- 业务特定方法（`getMinerUToken`, `getStatistics` 等）
- 类型安全和错误处理

#### Helpers (`helpers.js`)

- arXiv ID 提取
- 文件名清理和生成
- 下载管理
- 通知创建
- 时间/字节格式化

### 6. Environment Adaptation（环境适配层）

#### 6.1 DOM 解析策略

**挑战**：Chrome Extension Manifest V3 的 Service Worker 环境无法访问浏览器 DOM API。

**解决方案**：

- **Content Script**（浏览器环境）：
  - 直接使用原生 DOM API
  - 执行 Turndown 转换（CONVERT_HTML_TO_MARKDOWN）
  - 优势：性能最佳，完全兼容

- **Service Worker**（后台环境）：
  - 使用 linkedom 提供 DOM 模拟
  - 轻量级（~200KB），专为 Node.js/Worker 设计
  - 支持 Readability 和 Turndown 所需的基础 DOM API

**Why linkedom?**

对比方案：

| 方案 | 体积 | Service Worker 兼容 | 性能 | 决策 |
|------|------|---------------------|------|------|
| jsdom | ~5MB | 部分兼容 | 较慢 | ❌ 体积过大 |
| linkedom | ~200KB | ✅ 完全兼容 | 快速 | ✅ 最优选择 |
| happy-dom | ~300KB | ⚠️ 部分兼容 | 快速 | ⚠️ API 不完整 |

#### 6.2 转换流程分工

```
Content Script（浏览器环境）：
  ✓ 提取页面元数据
  ✓ 执行 HTML → Markdown 转换（Turndown）
  ✓ 处理文件下载

Service Worker（后台环境）：
  ✓ 协调转换策略（三层降级）
  ✓ 调用外部 API（ar5iv、MinerU）
  ✓ 管理存储和统计
```

**技术细节**：

Content Script 接收 `CONVERT_HTML_TO_MARKDOWN` 消息（src/content/index.js line 43）：

```javascript
case "CONVERT_HTML_TO_MARKDOWN":
  // 在真实浏览器环境中执行转换
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(htmlContent);
  sendResponse({ success: true, markdown });
  break;
```

这种设计确保了 Turndown 始终在拥有完整 DOM API 的环境中运行。

## 数据流

### 转换流程完整数据流

```
User Click
    ↓
Content Script
    ↓ [Message: CONVERT_PAPER]
Background Worker
    ↓ [Call: converter.convert()]
Main Converter
    ↓ [Strategy Decision]
ar5iv Converter / MinerU Client / PDF Fallback
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

## 错误处理策略

### 多层容错

1. **ar5iv 失败** → 自动切换到 MinerU
2. **MinerU 失败** → 降级到 PDF 下载
3. **网络错误** → 重试机制（最多 3 次）
4. **API 错误** → 友好提示用户

### 错误分类

- **User-facing**: Toast + 桌面通知
- **Developer**: Console logs (logger)
- **Analytics**: 统计数据更新

## 性能优化

### 1. 并行处理

- ar5iv 可用性检查（HEAD 请求）与元数据提取并行
- Webpack 代码分割（按模块懒加载）

### 2. 缓存策略

- Chrome Storage 缓存配置
- ar5iv HTML 可以考虑缓存（未实现）

### 3. 资源优化

- Turndown/Readability 使用单例模式
- 避免重复的 DOM 查询

### 4. 轻量级依赖

- linkedom（200KB）替代 jsdom（5MB），减少 96% 体积
- Service Worker 启动时间从 ~500ms 降至 ~50ms
- 内存占用减少约 80%

## 安全性

### 1. 输入验证

- arXiv ID 格式验证（正则表达式）
- 文件名清理（移除非法字符）
- URL 验证（防止 XSS）

### 2. API 安全

- MinerU Token 使用 `chrome.storage.sync`（加密存储）
- HTTPS-only 请求
- CORS 处理

### 3. 权限最小化

- 仅请求必要的 `host_permissions`
- Content Security Policy (Manifest V3)

## 可扩展性

### 插件化设计

所有转换器实现统一接口：

```javascript
interface Converter {
  convert(paperInfo): Promise<{markdown, metadata}>;
  checkAvailability?(arxivId): Promise<boolean>;
}
```

**新增转换器只需：**

1. 实现接口
2. 在 Main Converter 中注册
3. 添加到配置选项

### 配置驱动

- 所有常量集中在 `src/config/constants.js`
- 用户配置存储在 Chrome Storage
- 易于添加新选项

## 未来架构演进

### 1. 后端服务（可选）

```
Chrome Extension → 自建 API 服务 → MinerU/其他工具
```

**优势：**

- 统一管理 API Keys
- 批量处理队列
- 缓存热门论文

### 2. 多浏览器支持

- 使用 WebExtension Polyfill
- 抽象浏览器特定 API

### 3. 离线模式

- IndexedDB 缓存论文
- Service Worker 离线策略

---

**Last Updated**: 2025-12-02
**Version**: 1.0.0
