# 贡献指南

感谢你对 arXiv to Markdown 的关注！我们欢迎任何形式的贡献。

## 🚀 快速开始

1. **Fork 本仓库**
2. **克隆到本地**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/arxiv-md.git
   cd arxiv-md
   ```
3. **安装依赖**:
   ```bash
   npm install
   ```
4. **运行开发模式**:
   ```bash
   npm run dev
   ```
5. **在 Chrome 中加载扩展**:
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `dist` 目录

## 📝 提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型：**

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具链更新

**示例：**

```
feat(converter): 添加对 LaTeX 公式的支持

- 实现 MathML 到 LaTeX 的转换
- 支持行内和块级公式
- 添加单元测试

Closes #123
```

### 更多示例

**功能开发**：

```
feat(ui): 添加批量转换按钮

- 在 popup 页面添加"批量模式"选项
- 支持选择多个论文链接
- 添加进度条显示批量转换状态

Closes #45
```

**Bug 修复**：

```
fix(converter): 修复 LaTeX 公式转义错误

- 问题：特殊字符（$、{、}）未正确转义
- 修复：在 Turndown 规则中添加转义处理
- 测试：验证 10 篇包含复杂公式的论文

Fixes #78
```

**文档更新**：

```
docs(faq): 新增"转换进度卡住"问题解答

- 补充 3 种常见卡住场景
- 提供详细的排查步骤
- 添加截图说明（如有）
```

**性能优化**：

```
perf(converter): 优化 ar5iv HTML 解析性能

- 使用流式解析替代完整 DOM 构建
- 减少 50% 内存占用
- 转换速度提升 30%

Benchmark: 100 篇论文平均 0.8s → 0.56s
```

## 🏗️ 项目结构

```
src/
├── background/      # Service Worker
├── content/         # Content Script
├── core/            # 核心逻辑
├── ui/              # 用户界面
├── utils/           # 工具函数
└── config/          # 配置文件
```

## 🧪 测试

```bash
# 运行测试
npm test

# 代码检查
npm run lint
```

## ✅ Pull Request 检查清单

在提交 PR 之前，请确保完成以下检查：

### 代码质量

- [ ] 代码通过 `npm run lint` 检查（无错误和警告）
- [ ] 遵循项目的命名规范和代码风格
- [ ] 添加了必要的注释（特别是复杂逻辑）
- [ ] 移除了 `console.log` 和调试代码

### 功能完整性

- [ ] 功能按需求实现，无遗漏
- [ ] 处理了边界情况和错误场景
- [ ] 在 Chrome 中实际测试通过
- [ ] 测试了至少 3 篇不同类型的论文（如适用）

### 文档更新

- [ ] 更新了 README.md（如有新功能）
- [ ] 更新了 CHANGELOG.md（记录变更）
- [ ] 更新了相关文档（ARCHITECTURE.md、FAQ.md 等）
- [ ] 提交信息清晰，符合规范

### 兼容性

- [ ] 不破坏现有功能
- [ ] 向后兼容（如涉及配置变更）
- [ ] 在 Chrome 和 Edge 中测试通过

### PR 描述

- [ ] 清楚说明了更改的内容和原因
- [ ] 附上了截图或 GIF（如是 UI 改动）
- [ ] 关联了相关 Issue（使用 `Closes #123`）

## 📦 发布流程

1. 更新 `package.json` 和 `src/manifest.json` 的版本号
2. 运行 `npm run build`
3. 运行 `npm run package`
4. 测试生成的 ZIP 文件
5. 提交到 Chrome Web Store

## 💡 开发建议

- 遵循现有的代码风格
- 为新功能添加注释和文档
- 确保所有测试通过
- 更新 README.md（如需要）

## 🐛 报告 Bug

请在 [Issues](https://github.com/yourusername/arxiv-md/issues) 页面提交，包含：

- 复现步骤
- 预期行为
- 实际行为
- 浏览器版本和操作系统
- 截图（如有）

## 📝 文档贡献

**代码不是唯一的贡献方式！** 文档改进同样重要。

### 如何贡献文档

1. **发现错误**：拼写错误、过时信息、不清楚的表述
2. **提出改进**：补充示例、优化结构、增加图表
3. **翻译文档**：提供英文版文档（未来）
4. **补充 FAQ**：基于你的使用经验添加问题

### 文档 PR 检查

- [ ] Markdown 格式正确（使用预览工具检查）
- [ ] 所有链接有效（内部链接和外部链接）
- [ ] 代码示例可以直接复制运行
- [ ] 语言通顺，无语法错误

### 文档风格

- 使用简体中文
- 使用"你"而非"您"（友好风格）
- 适当使用 emoji 增强可读性 ✨
- 代码块使用三反引号并标注语言

## 🎯 首次贡献者

**欢迎你的第一次贡献！** 这里有一些适合首次贡献的任务：

### Good First Issue 标签

在 [Issues](https://github.com/[你的GitHub用户名]/arxiv-md/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) 页面查找 `good first issue` 标签的任务，这些通常是：

- 文档改进（错别字、补充说明）
- 简单的 UI 调整（按钮颜色、间距）
- 添加配置选项（现有功能的开关）

### 贡献流程

1. **选择任务**：在 Issues 中找一个你感兴趣的
2. **留言认领**：评论"我想解决这个问题"，避免重复工作
3. **开始开发**：按照上面的步骤进行
4. **提交 PR**：附上清晰的说明
5. **等待审查**：维护者会尽快回复

### 需要帮助？

- 💬 在 Issue 或 PR 中提问，我们会及时回复
- 📖 查看 [DEVELOPMENT.md](docs/DEVELOPMENT.md) 了解技术细节
- 🐛 遇到环境问题，可以在 Discussions 求助

## 📧 联系方式

- GitHub Issues: https://github.com/[你的GitHub用户名]/arxiv-md/issues
- Email: [项目维护者邮箱]（可选）

再次感谢你的贡献！ ❤️
