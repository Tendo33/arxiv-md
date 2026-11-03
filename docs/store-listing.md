# Chrome 应用商店上架文案

「to Markdown」系列三款插件（arXiv to Markdown / Zhihu to Markdown / Journal to Markdown）用同一套结构写商店文案：名称 → 简短说明 → 详细说明（一句话、能做什么、怎么用、隐私、同系列）。改动时三份一起改。

- 名称、简短说明和扩展包里的 `_locales/*/messages.json`（`extDescription`）保持一致，简短说明不超过 132 个字符。
- 详细说明只写扩展实际做到的事；隐私段与 [PRIVACY.md](../PRIVACY.md) 一致。

## 基本信息

| 项 | 内容 |
| --- | --- |
| 名称 | arXiv to Markdown（所有语言相同，不翻译） |
| 类别 | 工具（Tools） |
| 语言 | 中文（简体）、English |
| 主页 | https://github.com/Tendo33/arxiv-md |
| 支持 | https://github.com/Tendo33/arxiv-md/issues |
| 隐私政策 | https://github.com/Tendo33/arxiv-md/blob/main/PRIVACY.md |

## 简短说明

**中文**

> 一键把 arXiv 论文存为 Markdown：公式、表格、参考文献原样保留，PDF 按标题命名；没有 HTML 版的论文也能用 PDF 解析。

**English**

> Save arXiv papers as Markdown in one click: math, tables and references intact, PDFs named by title. Optional PDF parsing.

## 详细说明（中文）

```text
把 arXiv 论文一键存为干净的 Markdown，直接放进 Obsidian、Zotero、Logseq，或交给 AI 阅读。

能做什么
• 一键导出：论文摘要页 Submission history 下方多出 Markdown、PDF、BibTeX 三个按钮。
• 先用官方 HTML：优先转换 arXiv 官方 HTML 版，没有时用 ar5iv，都没有时保存 PDF。
• 结构完整：LaTeX 公式保留为 $…$ / $$…$$，表格转 Markdown（有合并单元格时保留 HTML），正文引用链接到参考文献，脚注转成 [^n]。
• 元数据：可选 YAML 头信息（标题、作者、arXiv ID、年份），方便笔记软件索引。
• PDF 按标题命名：下载的是「Attention Is All You Need (2017).pdf」，不是「1706.03762.pdf」。
• BibTeX 一键复制。
• PDF 解析（可选）：没有 HTML 版的论文，填入你自己的 PaddleOCR 或 MinerU Key 后解析 PDF，结果是含图片的 ZIP。
• 多个入口：页面按钮、工具栏弹窗、右键菜单、快捷键 Alt+Shift+M，PDF 页还有悬浮按钮。
• 中英文界面，跟随系统浅色 / 深色。

怎么用
1. 打开任意 arXiv 论文页，例如 arxiv.org/abs/1706.03762。
2. 点页面上的「Markdown」按钮，或点工具栏图标后选「导出 Markdown」。
3. 文件保存到浏览器的下载目录。

隐私
• 没有自己的服务器，不收集数据，没有统计或埋点。
• 标准模式完全在浏览器里完成，只访问 arXiv 和 ar5iv。
• 只有你主动使用 PDF 解析时，论文才会和你的 Key 一起发给你选定的那一个服务（PaddleOCR 或 MinerU）。Key 只保存在本机。

同系列
• Zhihu to Markdown：知乎文章、回答、问题和热榜存为 Markdown。
• Journal to Markdown：PMC、Nature、Frontiers 等期刊全文存为 Markdown。

需要 Chrome 121 或更高版本。

开源（MIT）：github.com/Tendo33/arxiv-md
```

## 详细说明（English）

```text
Save arXiv papers as clean Markdown in one click — ready for Obsidian, Zotero, Logseq, or your AI assistant.

What it does
• One-click export: adds Markdown, PDF and BibTeX buttons under Submission history on every abstract page.
• Official HTML first: converts arXiv's own HTML, falls back to ar5iv, and saves the PDF if neither exists.
• Structure intact: LaTeX math as $…$ / $$…$$, tables as Markdown (HTML when cells are merged), in-text citations linked to the references, footnotes as [^n].
• Metadata: optional YAML front matter (title, authors, arXiv ID, year) for note-taking apps.
• PDFs named by title: "Attention Is All You Need (2017).pdf" instead of "1706.03762.pdf".
• Copy BibTeX in one click.
• PDF parsing (optional): for papers without an HTML version, parse the PDF with your own PaddleOCR or MinerU key; the result is a ZIP with images.
• Several ways in: page buttons, toolbar popup, right-click menu, Alt+Shift+M, and a floating button on PDF pages.
• English and Chinese interface; follows your light or dark theme.

How to use
1. Open any arXiv paper, e.g. arxiv.org/abs/1706.03762.
2. Click the Markdown button on the page, or click the toolbar icon and choose Export Markdown.
3. The file lands in your downloads folder.

Privacy
• No servers of our own, no data collection, no analytics.
• Standard mode runs entirely in your browser and only talks to arXiv and ar5iv.
• Only when you use PDF parsing is the paper sent, with your key, to the one provider you chose (PaddleOCR or MinerU). Keys stay on this device.

Also in the series
• Zhihu to Markdown — save Zhihu articles, answers, questions and the hot list as Markdown.
• Journal to Markdown — save full-text articles from PMC, Nature, Frontiers and more as Markdown.

Requires Chrome 121 or later.

Open source (MIT): github.com/Tendo33/arxiv-md
```

## 图片素材（中文，可直接上传）

全部由真实扩展界面截取后合成，三款插件同一版式。生成方式：无界面 Chromium 加载 `dist/`，截取弹窗、设置页和页面内元素，导出的 Markdown 来自真实导出结果。

| 文件 | 尺寸 | 内容 |
| --- | --- | --- |
| `docs/store/screenshot-1.png` | 1280×800 | 一键把 arXiv 论文存为 Markdown（论文页按钮 + 弹窗） |
| `docs/store/screenshot-2.png` | 1280×800 | 公式、表格、参考文献原样保留（导出的 Markdown） |
| `docs/store/screenshot-3.png` | 1280×800 | 没有 HTML 版？用 PDF 解析（设置页） |
| `docs/store/screenshot-4.png` | 1280×800 | 浅色、深色都顺眼（深色模式） |
| `docs/store/promo-small-440x280.png` | 440×280 | 小型宣传图块（必填） |
| `docs/store/promo-marquee-1400x560.png` | 1400×560 | 顶部宣传图块（可选） |
| `docs/store/description.zh.txt` | — | 中文详细说明，粘贴到「说明」 |

## 单一用途说明

> 把用户正在阅读的 arXiv 论文转换为 Markdown 文件（或按标题命名的 PDF）并保存到本地。

Converts the arXiv paper the user is reading into a Markdown file (or a title-named PDF) and saves it locally.

## 权限理由

各权限的用途见 [README 权限说明](../README.md#权限说明)。提交审核时按该表逐项填写。
