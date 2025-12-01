# Assets 目录

此目录存放插件的图标和其他静态资源。

## 图标文件

请将以下图标文件放置在此目录：

- `icon-16.png` (16x16) - 工具栏小图标
- `icon-48.png` (48x48) - 扩展管理页面
- `icon-128.png` (128x128) - Chrome Web Store 和安装提示

## 图标设计建议

- 使用简洁的 Markdown 文档图标
- 主色调：紫色渐变 (#667eea → #764ba2)
- 背景透明
- 确保在不同尺寸下清晰可辨

## 生成图标

可以使用以下工具：
- [Figma](https://figma.com)
- [Canva](https://canva.com)
- [GIMP](https://www.gimp.org/)

或者使用在线 favicon 生成器，然后调整尺寸。

## 临时方案

在开发阶段，可以使用纯色占位图标：

```bash
# 使用 ImageMagick 生成占位图标（示例）
convert -size 16x16 xc:#667eea icon-16.png
convert -size 48x48 xc:#667eea icon-48.png
convert -size 128x128 xc:#667eea icon-128.png
```

