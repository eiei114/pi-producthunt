# Examples

Pi Product Hunt ships one extension entrypoint and typed agent tools for Product Hunt research.

## Local development

Load the checkout into Pi without publishing:

```bash
pi -e .
```

Authenticate and verify access:

```txt
/producthunt:login
/producthunt:status
```

## Interactive commands

`extensions/index.ts` registers human-facing `/producthunt:*` commands. These ask for input when needed:

```txt
/producthunt:today
/producthunt:search
/producthunt:post
/producthunt:comments
/producthunt:digest
/producthunt:research
/producthunt:watchlist
/producthunt:cards
```

Example flow:

```txt
/producthunt:search
```

Then enter a topic such as `AI coding agent` when Pi prompts for it.

## Agent tools

The same extension registers typed tools for autonomous research:

```txt
producthunt_status()
producthunt_get_posts({ limit: 5 })
producthunt_search_posts({ query: "AI coding agent", limit: 10 })
producthunt_get_post({ ref: "example-product-slug" })
producthunt_get_post_comments({ ref: "example-product-slug", limit: 10 })
producthunt_research_topic({ query: "AI coding agent", limit: 5, searchPool: 20, commentsPerPost: 3 })
producthunt_topic_watchlist({ query: "AI coding agent", limit: 5, searchPool: 20 })
producthunt_research_product_cards({ query: "AI coding agent", limit: 5, searchPool: 20 })
producthunt_digest({ limit: 10, commentsPerPost: 3 })
```

## Related docs

- [`watchlist.md`](watchlist.md) — when to use watchlists vs digests
- [`research-pack.md`](research-pack.md) — product card output examples
