# 更新日志

所有重要的项目变更都会记录在这个文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2025-12-01

### 🎉 首次发布

#### 新增功能
- ✨ 三层智能降级转换架构
  - Tier 1: ar5iv + 本地 Turndown（快速模式）
  - Tier 2: MinerU API 深度解析（质量模式）
  - Tier 3: PDF 兜底（始终有效）
- 🚀 ar5iv HTML → Markdown 转换器
  - 支持 LaTeX 公式（MathML 提取）
  - 支持表格（GitHub Flavored Markdown）
  - 支持图片（CDN 链接）
  - 支持引用和参考文献
- 🔥 MinerU API 客户端
  - 异步任务提交和轮询
  - 进度实时反馈
  - 错误处理和重试机制
- 📊 统计面板
  - 总转换次数
  - ar5iv 成功率
  - MinerU 使用次数
  - PDF 兜底次数
- ⚙️ 设置页面
  - 转换模式选择（快速/质量/极致）
  - MinerU Token 配置
  - 高级选项（通知、元数据等）
- 🎨 现代化 UI
  - 紫色渐变主题
  - 卡片式设计
  - 动画和过渡效果
  - 响应式布局
- 🔔 用户反馈
  - Toast 通知
  - 进度指示器
  - 成功/失败提示
  - 桌面通知

#### 技术特性
- 📦 Webpack 5 构建系统
- 🎯 ES6+ 现代 JavaScript
- 🛠️ 模块化架构（SOLID 原则）
- 📝 详细的代码注释
- 🧪 ESLint 代码检查
- 🚀 Chrome Extension Manifest V3

#### 文档
- 📖 完整的 README.md
- 📝 CONTRIBUTING.md 贡献指南
- 📄 CHANGELOG.md 更新日志
- 🔧 开发和构建文档

### 已知限制
- ar5iv 覆盖率约 85%（取决于 LaTeX 源码复杂度）
- MinerU 免费账号每天 2000 页额度
- 图片以外链形式保存（需联网查看）
- 仅支持 Chrome/Edge 浏览器

### 计划中的功能
- [ ] Firefox 版本
- [ ] 批量转换
- [ ] 本地图片下载选项
- [ ] 自定义 Markdown 模板
- [ ] 云同步设置

---

## [未发布]

### 即将推出
- 批量转换模式
- 图片本地化选项
- 更多转换模式

---

[1.0.0]: https://github.com/yourusername/arxiv-md/releases/tag/v1.0.0

