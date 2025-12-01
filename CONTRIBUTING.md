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

## 📧 联系方式

- GitHub Issues: https://github.com/yourusername/arxiv-md/issues
- Email: your.email@example.com

再次感谢你的贡献！ ❤️

