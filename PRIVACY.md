# Privacy Policy

**Last Updated: December 8, 2025**

## Overview

**arXiv to Markdown** is a Chrome extension designed to convert arXiv papers into Markdown format. We prioritize your privacy and are committed to transparency regarding our data practices.

## Data Collection & Storage

**We do not collect, store, or transmit any personal data.**

This extension operates entirely locally on your device.
- **Local Processing**: All conversions and downloads happen within your browser.
- **No External Servers**: No data is sent to our servers. We only interact with official arXiv services (arXiv.org, ar5iv.org) and optionally MinerU (if configured) to process content.

### Local Storage

We use Chrome's Storage API to save the following **locally**:
- **Preferences**: Language settings, notification toggles.
- **Statistics**: Conversion counts (successful ar5iv conversions, PDF downloads).

This data never leaves your device and is removed if you uninstall the extension.

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Save preferences and stats locally. |
| `downloads` | Save converted files to your device. |
| `activeTab` | Access arXiv page content for metadata. |
| `notifications` | Show status updates (optional). |

## Third-Party Services

- **ar5iv.org**: Used to fetch HTML5 versions of papers. No user data is sent.
- **MinerU (Optional)**: Only if you explicitly configure an API token, PDF files may be processed by MinerU. This is disabled by default.

## Contact & Open Source

This project is open source under the MIT License. You can verify our code and privacy practices on GitHub.

**GitHub**: [https://github.com/Tendo33/arxiv-md](https://github.com/Tendo33/arxiv-md)

If you have questions, please open an issue on our repository.
