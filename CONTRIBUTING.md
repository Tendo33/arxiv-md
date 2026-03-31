# Contributing

Thanks for contributing to `arXiv to Markdown`.

This repository is small, but it has a few moving parts that are easy to desynchronize: page UI, background orchestration, MinerU task handling, and the docs. The fastest way to help is to keep behavior, copy, and documentation aligned.

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/arxiv-md.git
cd arxiv-md
npm install
npm run dev
```

Load `dist/` at `chrome://extensions` with `Developer mode` enabled.

## Repository Layout

```text
src/
├── background/   # Service worker and message routing
├── content/      # arXiv page integration and Markdown conversion
├── core/         # converters, metadata extraction, task management
├── ui/           # popup and settings pages
├── utils/        # storage, helpers, logger
└── config/       # constants and translations

docs/
├── ARCHITECTURE.md
├── DEVELOPMENT.md
├── FAQ.md
└── mentor/       # guided maintainer docs
```

## Before You Open A PR

Run the local checks that make sense for your change:

```bash
npm run build
npm run lint
npm test
```

Also do manual verification when behavior changes. At minimum:

- test one paper where ar5iv works
- test one paper where ar5iv is unavailable and PDF fallback is expected
- test MinerU mode if you touched task flow, popup behavior, or settings

## Documentation Is Part Of The Change

If you change product behavior, update the docs in the same PR.

Typical files to review:

- `README.md`
- `README_CN.md`
- `docs/FAQ.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `PRIVACY.md`

If the change affects maintainer onboarding or code-reading flow, also update `docs/mentor/`.

## Pull Request Checklist

- the build still completes
- lint still passes
- tests were run, or you explain why they were not useful
- manual verification was done for the affected workflow
- user-facing copy is coherent in both English and Chinese when relevant
- documentation was updated for any behavior change

## Commit Guidance

Conventional commit prefixes are welcome but not required. Clear, specific commit messages matter more than ceremony.

Good examples:

- `fix: recover PDF fallback when ar5iv is unavailable`
- `docs: sync README and privacy policy with MinerU task flow`
- `feat: show duplicate-task confirmation for MinerU submissions`

## Good Contribution Areas

- Markdown conversion accuracy
- ar5iv cleanup and formatting rules
- MinerU task UX and robustness
- settings and localization quality
- documentation clarity and onboarding

## Bug Reports

Please include:

- the exact arXiv URL
- which mode you used
- what you expected
- what actually happened
- screenshots or console logs if available

## Questions

Open an issue if you are unsure where a change belongs. That is especially helpful for documentation, storage, and privacy-related changes because those tend to affect several files at once.
