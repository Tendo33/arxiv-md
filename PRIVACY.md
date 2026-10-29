# Privacy Policy

**Last updated: 2026-10-29**

## Overview

`arXiv to Markdown` is a browser extension for arXiv abstract pages. It does not operate a project-owned backend service, but it does communicate with third-party services that are required for paper retrieval and optional conversion features.

## What The Extension Stores

The extension uses two Chrome storage areas.

### `chrome.storage.sync`

Used for settings and lightweight preferences, including:

- conversion mode
- selected PDF parsing provider
- language
- notification preference
- auto-convert prompt preference
- PDF floating button preference
- Markdown metadata preference
- usage statistics

Usage statistics are counters only and are never sent to a project server.

These settings, including usage statistics, live in `chrome.storage.sync`: if you use browser account sync, your browser vendor syncs them through your browser account across devices. Provider credentials are not stored here and never sync (see below).

### `chrome.storage.local`

Used for:

- API keys for the PDF parsing provider you choose (PaddleOCR, MinerU). Keys are never synced and are sent only to the matching provider. Older versions kept the MinerU token in `chrome.storage.sync`; the update moves it here: it is copied to `chrome.storage.local` and then deleted from `chrome.storage.sync`. Because keys never sync, your other devices will not receive it; if they still have your chosen provider (that choice does sync) but no key, Settings and the popup ask you to re-enter the key on that device.

It also holds PDF parsing task state, including:

- task IDs
- task status and progress
- related arXiv metadata
- result ZIP URLs
- download IDs
- error messages
- ids of PDF parsing tasks you deleted, so a restarted background worker does not download them

This data is local to the browser profile that created the tasks.

Copying BibTeX writes that citation to your device clipboard. The extension requests it from arXiv and does not send it to a project server.

## Network Requests

Depending on the feature you use, the extension may make requests to:

- `https://arxiv.org/*`
- `https://export.arxiv.org/*`
- `https://ar5iv.org/*`
- `https://ar5iv.labs.arxiv.org/*`
- `https://mineru.net/*`
- `https://cdn-mineru.openxlab.org.cn/*`
- `https://paddleocr.aistudio-app.com/*` and its result-file domain `https://*.bj.bcebos.com/*`, only after you select PaddleOCR and grant permission

### Standard Mode

In standard mode, the extension:

- reads the current arXiv page
- fetches official arXiv HTML when the paper page contains a convertible article
- fetches ar5iv HTML when the official HTML page is missing or unusable
- may call the arXiv export API as metadata fallback

Markdown generation itself happens locally in the browser.

### PDF Parsing Mode

PDF parsing is used only when you choose "PDF high-quality parsing". The extension contacts the **single** provider you selected in Settings. It never switches providers automatically; on failure it only offers a button to open Settings.

What is sent depends on where the PDF is hosted and which provider you chose:

- **PDF hosted on arXiv** (`arxiv.org`, `export.arxiv.org`): PaddleOCR receives the PDF file itself (the extension downloads it from arXiv and uploads it, up to 50 MB; larger files are not sent). MinerU receives only the PDF link and downloads the paper itself.
- **Any other PDF**: both providers receive only the PDF link, never the file, and only after you confirm (see below).

**Open access.** All papers on arXiv are treated as open access; the extension does not check each paper's individual license. When the PDF is hosted on arXiv (`https://arxiv.org/pdf/…` or `https://export.arxiv.org/pdf/…`), the extension sends it to the provider you selected (the file for PaddleOCR, the link for MinerU) and parsing starts right away, with no confirmation prompt. For a PDF from any other source, or when the source cannot be determined, nothing is sent until you confirm: the task waits as "Awaiting" and its PDF link is sent only after you choose "Send & parse" in the popup. Your confirmation applies to that task only (retrying the same task does not ask again) and is not remembered for other PDFs. Every way of starting a parse (popup, right-click menu, floating button and keyboard shortcut) goes through this same check before anything is sent; when a parse started outside the popup needs confirmation, you get a notification and confirm in the popup.

#### PaddleOCR (default)

The extension sends your access token and the model name to `paddleocr.aistudio-app.com`, operated by Baidu (AI Studio). For papers hosted on arXiv (`arxiv.org`, `export.arxiv.org`), the extension downloads the public PDF itself and uploads the PDF file (up to 50 MB), because AI Studio does not accept arXiv links. A PDF larger than 50 MB is stopped before upload: nothing is sent to AI Studio, and the extension suggests switching to MinerU, which takes the link; for any other PDF it sends only the PDF link (`fileUrl`) and does not upload the file. The parse result (Markdown text and figure images) is then downloaded from Baidu's storage domain `*.bj.bcebos.com`. Access to both domains is requested together only when you select PaddleOCR, and you can revoke it at any time.

#### MinerU

MinerU is operated by 上海人工智能创新中心（上海人工智能实验室） (Shanghai Artificial Intelligence Innovation Center / Shanghai AI Laboratory), the operator named in its 「OpenDataLab」个人信息保护政策 (Chinese only): https://sso.openxlab.org.cn/protocol/privacy

The extension sends your MinerU bearer token, the PDF link for the selected paper, the model and language options, and the arXiv ID as task metadata to `mineru.net`. It does not upload the PDF file. MinerU processes the paper on its own service and returns a ZIP result URL (`cdn-mineru.openxlab.org.cn`), which the extension downloads. MinerU's domain access is unchanged from earlier versions and is granted at install.

Parsing providers are third parties, and their own terms govern how they process and retain what you submit. Neither Baidu AI Studio (PaddleOCR) nor MinerU publishes a specific retention period for uploaded files or parse results; AI Studio's privacy policy says only that information is kept "for the period necessary to provide the service". Don't send PDFs you aren't allowed to share with a third party.

## What The Extension Does Not Do

- It does not send your browsing history to a project-owned server.
- It does not upload arbitrary local files from your machine.
- It does not require an account with this project.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Save settings, statistics, and task state |
| `downloads` | Save Markdown, PDF, and PDF parsing results |
| `activeTab` | Read metadata from the current arXiv page |
| `notifications` | Show optional task and completion notifications |
| `alarms` | Periodically wake the background worker while PDF parsing tasks are running, to poll their progress; cleared when no task is active |
| `contextMenus` | Add right-click menu items on arXiv abs/pdf/html pages and on links to arXiv papers (PDF parsing items appear only when a key is set for the selected provider) |
| `https://paddleocr.aistudio-app.com/*` (optional) | Requested only when you select PaddleOCR |
| `https://*.bj.bcebos.com/*` (optional) | Requested together with PaddleOCR access; downloads the parse result (Markdown and figure images) from Baidu's storage |
| `declarativeNetRequestWithHostAccess` (optional) | Requested together with PaddleOCR access; removes the `Origin` header on requests to that domain only |

## Your Choices

You can:

- remove any provider key, or revoke PaddleOCR access, in Settings
- disable notifications
- clear completed or failed PDF parsing tasks from the popup
- uninstall the extension to remove its local extension data from the profile

If browser sync is enabled, synced settings may also need to be cleared from the same browser account.

## Open Source

This project is open source. You can inspect the current implementation here:

[https://github.com/Tendo33/arxiv-md](https://github.com/Tendo33/arxiv-md)

## Contact

If you have questions about privacy or data handling, please open an issue in the repository.
