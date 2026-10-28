# Privacy Policy

**Last updated: September 28, 2026**

> **Pending review (Round 4 draft):** the PDF parsing sections below follow `pdf-parser-privacy-draft.md` v2 and are not final. Provider retention periods and the MinerU legal operator are still to be verified. Update the date above at release.

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

- API keys for the PDF parsing provider you choose (PaddleOCR, MinerU). Keys are never synced and are sent only to the matching provider. Older versions kept the MinerU token in `chrome.storage.sync`; the update moves it here and deletes the synced copy.

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
- `https://paddleocr.aistudio-app.com/*`, only after you select PaddleOCR and grant permission (the result-file domain is pending QA)

### Standard Mode

In standard mode, the extension:

- reads the current arXiv page
- fetches official arXiv HTML when the paper page contains a convertible article
- fetches ar5iv HTML when the official HTML page is missing or unusable
- may call the arXiv export API as metadata fallback

Markdown generation itself happens locally in the browser.

### PDF Parsing Mode

PDF parsing is used only when you choose "PDF high-quality parsing". The extension contacts the **single** provider you selected in Settings. It never switches providers automatically; on failure it only offers a button to open Settings.

#### PaddleOCR (default)

The extension sends the paper's public PDF URL and your access token to `paddleocr.aistudio-app.com`, operated by Baidu (AI Studio). If the service cannot fetch the URL, the PDF file itself may be uploaded instead (pending QA). Access to this domain is requested only when you select PaddleOCR, and you can revoke it at any time.

#### MinerU

The extension sends your MinerU bearer token, the arXiv PDF URL for the selected paper, and the arXiv ID as task metadata to `mineru.net`. It does not upload the PDF file. MinerU processes the paper on its own service and returns a ZIP result URL (`cdn-mineru.openxlab.org.cn`), which the extension downloads. MinerU's domain access is unchanged from earlier versions and is granted at install.

Parsing providers are third parties, and their own terms govern how they process and retain what you submit. Retention periods for both providers are still to be verified.

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
