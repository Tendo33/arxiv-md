# Privacy Policy

**Last updated: March 31, 2026**

## Overview

`arXiv to Markdown` is a browser extension for arXiv abstract pages. It does not operate a project-owned backend service, but it does communicate with third-party services that are required for paper retrieval and optional conversion features.

## What The Extension Stores

The extension uses two Chrome storage areas.

### `chrome.storage.sync`

Used for settings and lightweight preferences, including:

- conversion mode
- MinerU API token
- language
- notification preference
- auto-convert prompt preference
- Markdown metadata preference
- usage statistics

If you use browser account sync, this data may sync through your browser account across devices.

### `chrome.storage.local`

Used for MinerU task state, including:

- task IDs
- task status and progress
- related arXiv metadata
- result ZIP URLs
- download IDs
- error messages

This data is local to the browser profile that created the tasks.

## Network Requests

Depending on the feature you use, the extension may make requests to:

- `https://arxiv.org/*`
- `https://export.arxiv.org/*`
- `https://ar5iv.org/*`
- `https://ar5iv.labs.arxiv.org/*`
- `https://mineru.net/*`
- `https://cdn-mineru.openxlab.org.cn/*`

### Standard Mode

In standard mode, the extension:

- reads the current arXiv page
- checks whether an ar5iv HTML version exists
- fetches ar5iv HTML when available
- may call the arXiv export API as metadata fallback

Markdown generation itself happens locally in the browser.

### MinerU Mode

MinerU mode is optional and only used when you enable it and provide a token.

In MinerU mode, the extension sends information to MinerU, including:

- your MinerU bearer token
- the arXiv PDF URL for the selected paper
- the arXiv ID as task metadata

MinerU then processes that paper on its own service and returns a ZIP result URL, which the extension downloads.

## What The Extension Does Not Do

- It does not send your browsing history to a project-owned server.
- It does not upload arbitrary local files from your machine.
- It does not require an account with this project.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Save settings, statistics, and task state |
| `downloads` | Save Markdown, PDF, and MinerU ZIP results |
| `activeTab` | Read metadata from the current arXiv page |
| `notifications` | Show optional task and completion notifications |

## Your Choices

You can:

- remove the MinerU token from settings
- disable notifications
- clear completed or failed MinerU tasks from the popup
- uninstall the extension to remove its local extension data from the profile

If browser sync is enabled, synced settings may also need to be cleared from the same browser account.

## Open Source

This project is open source. You can inspect the current implementation here:

[https://github.com/Tendo33/arxiv-md](https://github.com/Tendo33/arxiv-md)

## Contact

If you have questions about privacy or data handling, please open an issue in the repository.
