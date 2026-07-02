# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [0.3.1] - 2026-07-03

### Fixed

- `getPostComments` now uses `NEWEST` order instead of `RANKING` (Product Hunt API does not accept
  `RANKING` for comments, causing all comment fetches to fail).
- `researchTopic` default search pool reduced from 75 to 20 to stay under the Product Hunt API query
  complexity cap. The `searchPool` parameter is now exposed on `producthunt_topic_watchlist` and
  `producthunt_research_topic` tools/commands for callers who need a wider scan.
- `searchPosts` default search pool reduced from 50 to 20 for the same complexity reason.

### Added

- `searchPool` parameter on `producthunt_topic_watchlist`, `producthunt_research_topic`,
  `producthunt_research_product_cards`, and `/producthunt:watchlist` / `/producthunt:research` / `/producthunt:cards`.
- `docs/watchlist.md` sections describing ranking algorithm, comment signal classification, bounded
  rationale, and search pool guidance.
- Tests for rationale truncation with many topics and pre-truncated rationale display.

## [0.3.0] - 2026-07-02

### Added

- Bounded markdown product cards for research-pack note workflows.
- `producthunt_research_product_cards` agent tool and `/producthunt:cards` command.
- `docs/research-pack.md` with when to prefer product cards over raw tool output.
- Tests for single-card, multi-card, and empty-result formatting.

## [0.2.0] - 2026-06-28

### Added

- Auth diagnostics for `/producthunt:status` and `producthunt_status` report active token source (environment vs stored login).
- Actionable recovery guidance for missing tokens, unreadable auth files, invalid stored tokens, and API validation failures.
- Tests for env, stored, missing, unreadable, and invalid token scenarios.
- Compact topic watchlist output with bounded rationale fields (`why promising`, `launch timing`, `next url`).
- `producthunt_topic_watchlist` agent tool and `/producthunt:watchlist` command for revisit-only shortlists.
- Watchlist derivation from topic research and digest workflows.
- `docs/watchlist.md` explaining when to use watchlist vs full research or digest output.

### Changed

- `inspectStoredAccessToken()` distinguishes missing, unreadable, and invalid stored login files.

## [0.1.4] - 2026-06-27

### Changed

- Aligned README structure with the current Pi extension template while preserving Product Hunt authentication, commands, and agent tool documentation.

## [0.1.3] - 2026-06-05

### Changed

- Patch bump to verify npm publish workflow.

## [0.1.2] - 2026-06-05

### Changed

- Removed stale template scaffolding docs from the published package.

## [0.1.1] - 2026-06-01

### Changed

- Publish workflow now supports npm publishing on merged package version bumps in addition to tags, releases, and manual dispatch.
- Publish workflow now installs a current npm CLI so npm Trusted Publishing OIDC is supported.
- CI and publish workflow commands no longer include literal trailing `\\n` text.

## [0.1.0] - YYYY-MM-DD

### Added

- Initial Pi package template.
- Example extension, Agent Skill, prompt, and theme.
- CI and npm Trusted Publishing workflow.
