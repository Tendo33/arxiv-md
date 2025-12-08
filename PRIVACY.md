# Privacy Policy for arXiv to Markdown

**Last Updated: December 8, 2025**

## Overview

arXiv to Markdown is a Chrome browser extension that converts arXiv academic papers to Markdown format. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection

**We do not collect, store, or transmit any personal data.**

This extension operates entirely locally on your device. All paper conversions and file downloads are processed within your browser without sending any information to external servers (except for fetching paper content from arXiv and ar5iv, which are official arXiv services).

## Data Storage

The extension stores the following data **locally on your device** using Chrome's Storage API:

- **User Preferences**: Language settings (Chinese/English), notification preferences
- **Usage Statistics**: Conversion success counts (number of successful ar5iv conversions, PDF downloads)

This data:
- Never leaves your device
- Is not transmitted to any external servers
- Is not shared with any third parties
- Can be cleared by uninstalling the extension

## Permissions Used

| Permission | Purpose |
|------------|---------|
| `storage` | Save user preferences and conversion statistics locally |
| `downloads` | Save converted Markdown files and PDFs to your device |
| `activeTab` | Access arXiv page content to extract paper metadata |
| `notifications` | Display conversion status notifications (can be disabled) |

## Host Permissions

| Domain | Purpose |
|--------|---------|
| `arxiv.org` | Inject UI buttons and extract paper metadata |
| `ar5iv.org` | Fetch HTML5 versions of papers for conversion |
| `export.arxiv.org` | Download PDF files |
| `mineru.net` | Optional: Advanced PDF conversion (only if user configures API token) |

## Third-Party Services

- **ar5iv.org**: We fetch HTML content from ar5iv (an official arXiv HTML rendering service) to convert papers to Markdown. No user data is sent to ar5iv.
- **MinerU (Optional)**: If you choose to configure a MinerU API token in settings, PDF files may be sent to MinerU's servers for conversion. This is entirely optional and disabled by default.

## Data Sharing

We do not:
- Sell or transfer user data to third parties
- Use data for purposes unrelated to the extension's functionality
- Use data for credit determination or lending purposes
- Track your browsing history
- Collect any personal information

## Children's Privacy

This extension does not knowingly collect any personal information from children under 13 years of age.

## Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document.

## Contact

If you have any questions about this Privacy Policy, please open an issue on our GitHub repository:

**GitHub**: [https://github.com/Tendo33/arxiv-md](https://github.com/Tendo33/arxiv-md)

## Open Source

This extension is open source under the MIT License. You can review the complete source code on GitHub to verify our privacy practices.

---

© 2025 SimonSun. All rights reserved.

