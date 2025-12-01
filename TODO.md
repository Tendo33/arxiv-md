# 待办事项（TODO）

## 🚨 发布前必须完成

### 关键任务
- [ ] **创建图标文件** `assets/icon-*.png`
  - [ ] icon-16.png (16x16)
  - [ ] icon-48.png (48x48)
  - [ ] icon-128.png (128x128)
  - 建议：使用 Figma/Canva 设计紫色渐变的 Markdown 文档图标

- [ ] **首次构建**
  ```bash
  npm install
  npm run build
  ```

- [ ] **手动测试**
  - [ ] 测试 ar5iv 转换（常见论文）
  - [ ] 测试 MinerU 转换（配置 Token）
  - [ ] 测试 PDF 兜底（移除 Token）
  - [ ] 测试 Popup UI
  - [ ] 测试 Settings 页面
  - [ ] 测试统计数据更新

- [ ] **修复潜在问题**
  - [ ] 检查 ESLint 错误
  - [ ] 修复任何构建警告
  - [ ] 确保所有模块正确导入

### 可选任务
- [ ] 添加单元测试
- [ ] 添加 GitHub Actions CI/CD
- [ ] 创建 Demo 视频
- [ ] 准备 Chrome Web Store 截图

---

## 📋 v1.0.0 发布清单

### 代码质量
- [x] 所有核心功能实现
- [x] 代码注释完整
- [x] 遵循 RIPER-7 标准
- [ ] 运行 ESLint 检查
- [ ] 修复所有 linter 错误

### 文档
- [x] README.md
- [x] CHANGELOG.md
- [x] CONTRIBUTING.md
- [x] PROJECT_STRUCTURE.md
- [x] docs/ARCHITECTURE.md
- [x] docs/DEVELOPMENT.md
- [x] docs/QUICK_START.md
- [x] docs/FAQ.md
- [ ] 创建 Demo GIF/视频

### 测试
- [ ] 手动功能测试
- [ ] 跨浏览器测试（Chrome/Edge）
- [ ] 不同论文类型测试
- [ ] 错误处理测试
- [ ] 性能测试

### 发布准备
- [ ] 更新 manifest.json 版本号
- [ ] 更新 package.json 版本号
- [ ] 生成 build/arxiv-md-v1.0.0.zip
- [ ] 准备 Chrome Web Store 素材
  - [ ] 扩展图标（128x128）
  - [ ] 宣传图（440x280）
  - [ ] 截图（至少 1 张，最多 5 张）
  - [ ] 扩展描述文案

---

## 🚀 v1.1.0 计划

### 新功能
- [ ] 批量转换模式
  - [ ] 在搜索结果页添加"全选转换"按钮
  - [ ] 后台队列处理
  - [ ] 进度展示

- [ ] 图片本地化
  - [ ] 添加"打包下载"选项
  - [ ] 图片和 Markdown 打包为 ZIP
  - [ ] 自动替换图片路径

- [ ] 自定义 Markdown 模板
  - [ ] 允许用户自定义元数据格式
  - [ ] 支持变量替换
  - [ ] 预设模板库

### 改进
- [ ] 快捷键支持
  - [ ] Alt+M: 快速转换
  - [ ] Alt+Shift+M: 打开设置

- [ ] 更好的进度反馈
  - [ ] 进度条显示百分比
  - [ ] 预估剩余时间
  - [ ] 可取消的转换

- [ ] 性能优化
  - [ ] 缓存 ar5iv 可用性检查
  - [ ] 并行转换多个文件
  - [ ] 减少内存占用

---

## 🔮 v1.2.0 计划

### 跨浏览器支持
- [ ] Firefox 版本
  - [ ] 使用 WebExtension Polyfill
  - [ ] 适配 Firefox Manifest
  - [ ] 发布到 Firefox Add-ons

### 多网站支持
- [ ] bioRxiv 支持
- [ ] medRxiv 支持
- [ ] SSRN 支持
- [ ] 其他预印本网站

### 云功能
- [ ] 云同步配置
  - [ ] 跨设备同步 Token
  - [ ] 同步转换历史
  - [ ] 同步统计数据

- [ ] 转换历史
  - [ ] 记录所有转换的论文
  - [ ] 重新下载历史文件
  - [ ] 导出转换记录

---

## 💡 未来想法

### 高级功能
- [ ] 离线模式
  - [ ] IndexedDB 缓存论文
  - [ ] Service Worker 离线策略
  - [ ] 离线搜索功能

- [ ] AI 增强
  - [ ] 自动生成摘要
  - [ ] 关键词提取
  - [ ] 智能分类

- [ ] 协作功能
  - [ ] 分享转换结果
  - [ ] 团队共享库
  - [ ] 评论和标注

### 集成
- [ ] Zotero 集成
- [ ] Mendeley 集成
- [ ] Notion API 集成
- [ ] Obsidian 插件

### 自建服务
- [ ] 搭建后端 API
  - [ ] 统一管理 API Keys
  - [ ] 批量处理队列
  - [ ] 缓存热门论文
  - [ ] 提供 RESTful API

---

## 🐛 已知问题

### 需要修复
- [ ] ar5iv 某些公式可能转换不完美
- [ ] 图片外链在离线时无法查看
- [ ] MinerU Token 验证未实现（仅格式检查）
- [ ] 统计数据在卸载后会丢失

### 需要改进
- [ ] Content Script 注入时机可以更早
- [ ] Popup 加载速度可以优化
- [ ] 错误提示可以更友好
- [ ] 日志可以支持远程上报（可选）

---

## 📝 文档待办

- [ ] 录制使用演示视频
- [ ] 创建动图（GIF）展示核心功能
- [ ] 编写更多使用案例
- [ ] 翻译英文文档
- [ ] 添加 API 文档（如果开放给其他开发者）

---

## 🤝 社区待办

- [ ] 创建 GitHub Discussions
- [ ] 设置 Issue 模板
- [ ] 设置 PR 模板
- [ ] 创建 Discord/Telegram 群组
- [ ] 建立贡献者榜单

---

## 📊 监控和分析

- [ ] 添加使用统计（匿名，可选）
  - [ ] 转换成功率
  - [ ] 平均转换时间
  - [ ] 常见错误类型
- [ ] 错误日志上报（可选，需用户同意）
- [ ] 性能监控

---

**更新日期**: 2025-12-01  
**最后编辑**: RIPER-7 AI Assistant

