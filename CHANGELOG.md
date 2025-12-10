# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-03

### 🚀 New Features

- **Smart Button Display**: Automatically detects ar5iv source availability. Hides "Save as Markdown" button for new papers not yet processed by ar5iv to prevent invalid clicks.
- **Multi-language Support**: Added Chinese/English interface switching, automatically adapting to user preferences.
- **UI Optimization**:
  - Simplified Popup window, removing redundant information.
  - Optimized settings page layout, removing non-core sections like "About MinerU" and "License".
  - Unified overall visual style for a cleaner, modern look.

### 🔄 Changes

- Removed static information sections from the settings page that were no longer needed.
- Optimized button injection logic to improve stability during page load.

## [1.0.0] - 2025-12-02

### 🎉 Initial Release

#### New Features

- ✨ Three-Tier Smart Fallback Architecture
  - Tier 1: ar5iv + Local Turndown (Fast Mode)
  - Tier 2: MinerU API Deep Parsing (Quality Mode)
  - Tier 3: PDF Fallback (Always works)
- 🚀 ar5iv HTML → Markdown Converter
  - Supports LaTeX formulas (MathML extraction)
  - Supports tables (GitHub Flavored Markdown)
  - Supports images (CDN links)
  - Supports citations and references
- 🔥 MinerU API Client
  - Asynchronous task submission and polling
  - Real-time progress feedback
  - Error handling and retry mechanism
- 📊 Statistics Panel
  - Total conversions
  - ar5iv success rate
  - MinerU usage count
  - PDF fallback count
- ⚙️ Settings Page
  - Conversion mode selection (Fast/Quality/Extreme)
  - MinerU Token configuration
  - Advanced options (notifications, metadata, etc.)
- 🎨 Modern UI
  - Purple gradient theme
  - Card-style design
  - Animations and transitions
  - Responsive layout
- 🔔 User Feedback
  - Toast notifications
  - Progress indicators
  - Success/Failure alerts
  - Desktop notifications

#### Technical Features

- 📦 Webpack 5 Build System
- 🎯 ES6+ Modern JavaScript
- 🛠️ Modular Architecture (SOLID Principles)
- 📝 Detailed Code Comments
- 🧪 ESLint Code Linting
- 🚀 Chrome Extension Manifest V3

#### Documentation

- 📖 Complete README.md (Added project status and documentation navigation)
- 📝 CONTRIBUTING.md (Enhanced PR checklist and first-time contributor guide)
- 📄 CHANGELOG.md
- 🏗️ ARCHITECTURE.md (Added linkedom environment adaptation details)
- 🔧 DEVELOPMENT.md (Enhanced debugging tips and practical code examples)
- ❓ FAQ.md (Added practical questions and performance issues categories)
- 🚀 QUICK_START.md (Simplified to three-step process)
- 📦 INSTALL.md (Optimized verification steps and troubleshooting)

### Known Limitations

- ar5iv coverage approx. 85% (depends on LaTeX source complexity)
- MinerU free account limit: 2000 pages/day
- Images saved as external links (requires internet to view)
- Only supports Chrome/Edge browsers

### Planned Features

- [ ] Firefox Version
- [ ] Batch Conversion
- [ ] Local Image Download Option
- [ ] Custom Markdown Templates
- [ ] Cloud Settings Sync

---

## [Unreleased]

### Coming Soon

- Batch Conversion Mode
- Image Localization Option
- Firefox Version Support
- More Customization Options

---

[1.0.0]: https://github.com/[YOUR_USERNAME]/arxiv-md/releases/tag/v1.0.0
