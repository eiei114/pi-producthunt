# Pi Product Hunt

[![CI](https://github.com/eiei114/pi-producthunt/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-producthunt/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-producthunt/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-producthunt/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/pi-producthunt.svg)](https://www.npmjs.com/package/pi-producthunt)
[![npm downloads](https://img.shields.io/npm/dm/pi-producthunt.svg)](https://www.npmjs.com/package/pi-producthunt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](docs/release.md)

> Product Hunt research and digest workflows inside Pi.

## What this is

Pi Product Hunt is a read-only Pi extension package for Product Hunt market research. It calls the Product Hunt GraphQL API directly, adds interactive `/producthunt:*` commands for humans, and exposes structured tools for agents to gather launches, post details, comments, and digest-ready research notes.

## Features

- Daily Product Hunt launch scans.
- Product/post search for competitor and trend research.
- Post detail and comment collection for user-reaction analysis.
- Digest-ready Markdown with sections for signals, reactions, and topic watchlists.
- Compact topic watchlists with bounded rationale for products worth revisiting.
- Persistent login that stores your Product Hunt token in the Pi agent directory.
- Agent tools with typed parameters for autonomous Product Hunt research.

## Install

Install the published npm package with Pi:

```bash
pi install npm:pi-producthunt
```

Pin a specific version when you want reproducible installs:

```bash
pi install npm:pi-producthunt@0.1.4
```

Install into the current project instead of your user Pi settings:

```bash
pi install npm:pi-producthunt -l
```

Or install from GitHub:

```bash
pi install git:github.com/eiei114/pi-producthunt
```

Try without installing permanently:

```bash
pi -e npm:pi-producthunt
```

For local development from a checkout:

```bash
pi -e .
```

## Quick start

1. Install the package:

```bash
pi install npm:pi-producthunt
```

2. Authenticate with Product Hunt:

```txt
/producthunt:login
```

3. Fetch today's launches:

```txt
/producthunt:today
```

Or search for a topic:

```txt
/producthunt:search
```

Agents can fetch Product Hunt data directly with typed tools:

```txt
producthunt_get_posts({ limit: 5 })
producthunt_search_posts({ query: "AI coding agent", limit: 10 })
```

## Authentication

Use the interactive login command:

```txt
/producthunt:login
```

This stores your token in:

```txt
~/.pi/agent/pi-producthunt-auth.json
```

You can remove the stored token with:

```txt
/producthunt:logout
```

You can also provide a token through the environment. Environment auth takes priority over the stored login token:

```bash
export PRODUCTHUNT_ACCESS_TOKEN=...
```

## Commands

Commands are human-facing and require no fixed inline arguments. If input is needed, Pi asks interactively.

```txt
/producthunt:status
/producthunt:login
/producthunt:logout
/producthunt:today
/producthunt:search
/producthunt:post
/producthunt:comments
/producthunt:digest
/producthunt:research
/producthunt:watchlist
```

Example flows:

```txt
/producthunt:today      # today's launch list
/producthunt:search     # asks for a search query
/producthunt:post       # asks for slug, ID, or URL
/producthunt:comments   # asks for slug, ID, or URL
/producthunt:digest     # asks for today / yesterday / custom date
/producthunt:research   # asks for a research topic
/producthunt:watchlist  # asks for a topic and returns a compact revisit list
```

## Agent tools

Agents can call these typed tools directly:

```txt
producthunt_status
producthunt_get_posts
producthunt_search_posts
producthunt_get_post
producthunt_get_post_comments
producthunt_research_topic
producthunt_topic_watchlist
producthunt_digest
```

Examples:

```txt
producthunt_search_posts({ query: "AI coding agent", limit: 10 })
producthunt_get_post({ ref: "example-product-slug" })
producthunt_get_post_comments({ ref: "example-product-slug", limit: 10 })
producthunt_digest({ date: "2026-06-01", limit: 10 })
producthunt_topic_watchlist({ query: "AI coding agent", limit: 5 })
```

See [`docs/watchlist.md`](docs/watchlist.md) for when to use a watchlist vs a full digest or research pack.

## Package contents

| Path | Purpose |
|---|---|
| `extensions/` | Pi extension entrypoint and command/tool registration |
| `lib/` | Product Hunt API client, auth store, formatters, schemas, helpers |
| `docs/` | Release notes, usage examples, and watchlist guidance |

## Development

```bash
npm install
npm run ci
```

`npm run ci` runs:

- TypeScript typecheck
- Node tests
- `npm pack --dry-run`

## Release

This package is set up for npm Trusted Publishing, so no `NPM_TOKEN` is required.

```bash
npm version patch
git push
```

See [`docs/release.md`](docs/release.md) for setup details.

## Security

Pi packages execute with your local permissions. Review source before installing third-party packages.

Product Hunt tokens are never committed by this package. `/producthunt:login` stores the token locally in `~/.pi/agent/pi-producthunt-auth.json`; `/producthunt:logout` deletes that stored file. `PRODUCTHUNT_ACCESS_TOKEN` is never modified by logout.

For vulnerability reporting, see [`SECURITY.md`](SECURITY.md).

## Links

- npm: https://www.npmjs.com/package/pi-producthunt
- GitHub: https://github.com/eiei114/pi-producthunt
- Issues: https://github.com/eiei114/pi-producthunt/issues

## License

MIT
