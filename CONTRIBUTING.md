# Contributing Guide

Thank you for your interest in arXiv to Markdown! We welcome contributions in any form.

## 🚀 Quick Start

1. **Fork this repository**
2. **Clone to local**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/arxiv-md.git
   cd arxiv-md
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run in development mode**:
   ```bash
   npm run dev
   ```
5. **Load extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

## 📝 Commit Convention

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation update
- `style`: Code style (formatting, missing semi colons, etc)
- `refactor`: Refactoring (no functional changes)
- `test`: Adding or updating tests
- `chore`: Build process or tool changes

**Example:**

```
feat(converter): Add support for LaTeX formulas

- Implement MathML to LaTeX conversion
- Support inline and block formulas
- Add unit tests

Closes #123
```

### More Examples

**Feature Development**:

```
feat(ui): Add batch conversion button

- Add "Batch Mode" option in popup
- Support selecting multiple paper links
- Add progress bar for batch conversion

Closes #45
```

**Bug Fix**:

```
fix(converter): Fix LaTeX formula escaping error

- Issue: Special characters ($, {, }) not properly escaped
- Fix: Add escape handling in Turndown rules
- Test: Verify with 10 papers containing complex formulas

Fixes #78
```

**Documentation Update**:

```
docs(faq): Add "Conversion Stuck" troubleshooting

- Add 3 common scenarios for hanging conversions
- Provide detailed troubleshooting steps
- Add screenshots
```

**Performance Optimization**:

```
perf(converter): Optimize ar5iv HTML parsing

- Use streaming parsing instead of full DOM construction
- Reduce memory usage by 50%
- Improve conversion speed by 30%

Benchmark: 100 papers average 0.8s -> 0.56s
```

## 🏗️ Project Structure

```
src/
├── background/      # Service Worker
├── content/         # Content Script
├── core/            # Core Logic
├── ui/              # User Interface
├── utils/           # Utility Functions
└── config/          # Configuration Files
```

## 🧪 Testing

```bash
# Run tests
npm test

# Lint code
npm run lint
```

## ✅ Pull Request Checklist

Before submitting a PR, please ensure the following:

### Code Quality

- [ ] Code passes `npm run lint` (no errors or warnings)
- [ ] Follows project naming conventions and code style
- [ ] Added necessary comments (especially for complex logic)
- [ ] Removed `console.log` and debug code

### Functional Integrity

- [ ] Feature implemented as requested, no omissions
- [ ] Handled edge cases and error scenarios
- [ ] Tested in Chrome
- [ ] Tested with at least 3 different papers (if applicable)

### Documentation

- [ ] Updated README.md (if new features added)
- [ ] Updated CHANGELOG.md (record changes)
- [ ] Updated related docs (ARCHITECTURE.md, FAQ.md, etc.)
- [ ] Commit messages are clear and follow conventions

### Compatibility

- [ ] Does not break existing functionality
- [ ] Backward compatible (if configuration changes involved)
- [ ] Tested in Chrome and Edge

### PR Description

- [ ] Clearly explain changes and reasons
- [ ] Attach screenshots or GIFs (for UI changes)
- [ ] Link related Issues (use `Closes #123`)

## 📦 Release Process

1. Update version in `package.json` and `src/manifest.json`
2. Run `npm run build`
3. Run `npm run package`
4. Test the generated ZIP file
5. Submit to Chrome Web Store

## 💡 Development Tips

- Follow existing code style
- Add comments and documentation for new features
- Ensure all tests pass
- Update README.md if needed

## 🐛 Reporting Bugs

Please submit via [Issues](https://github.com/yourusername/arxiv-md/issues), including:

- Reproduction steps
- Expected behavior
- Actual behavior
- Browser version and OS
- Screenshots (if applicable)

## 📝 Contributing Documentation

**Code is not the only way to contribute!** Documentation improvements are equally important.

### How to Contribute Docs

1. **Find errors**: Typos, outdated info, unclear wording
2. **Propose improvements**: Add examples, optimize structure, add diagrams
3. **Translate**: Provide translations
4. **Add FAQs**: Add questions based on your experience

### Doc PR Checklist

- [ ] Markdown format is correct
- [ ] All links are valid
- [ ] Code examples are runnable
- [ ] Language is clear and grammatically correct

### Documentation Style

- Use English
- Use "You" instead of "One" or passive voice (friendly tone)
- Use emojis appropriately to enhance readability ✨
- Use triple backticks for code blocks and specify language

## 🎯 First Time Contributors

**Welcome to your first contribution!** Here are some tasks suitable for beginners:

### Good First Issue

Look for tasks labeled `good first issue` in [Issues](https://github.com/[YOUR_USERNAME]/arxiv-md/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22):

- Documentation improvements (typos, clarifications)
- Simple UI adjustments (colors, spacing)
- Adding config options (toggles for existing features)

### Contribution Flow

1. **Select a task**: Find one you like in Issues
2. **Claim it**: Comment "I'd like to work on this" to avoid duplicates
3. **Start coding**: Follow the steps above
4. **Submit PR**: Include clear description
5. **Wait for review**: Maintainers will reply ASAP

### Need Help?

- 💬 Ask in Issue or PR
- 📖 Read [DEVELOPMENT.md](docs/DEVELOPMENT.md) for technical details
- 🐛 Ask in Discussions for environment issues

## 📧 Contact

- GitHub Issues: https://github.com/[YOUR_USERNAME]/arxiv-md/issues
- Email: [Maintainer Email] (Optional)

Thanks again for your contribution! ❤️
