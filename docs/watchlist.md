# Watchlist output

Pi Product Hunt can emit a compact **topic watchlist** when you want a short revisit list instead of rereading a full research dump.

## When to use each output

| Output | Best for | Includes |
|---|---|---|
| `producthunt_research_product_cards` / `/producthunt:cards` | Paste launch cards into notes | Compact per-product cards with launch fields |
| `producthunt_topic_watchlist` / `/producthunt:watchlist` | Revisit shortlist only | Up to 5 products with bounded rationale |
| `producthunt_research_topic` / `/producthunt:research` | Market or competitor research | Post details, comment signals, synthesis prompts, watchlist |
| `producthunt_digest` / `/producthunt:digest` | Daily launch note material | Top launches, signals scaffold, reactions scaffold, watchlist |

Use product cards when you want stable note blocks without copying raw tool `details` JSON. Use the watchlist when you already know the topic and only need promising products to inspect later. Use the full research pack when you still need comment evidence and synthesis prompts. Use the digest when the date matters more than the search query.

See [`research-pack.md`](research-pack.md) for a product-card example.

## Watchlist fields

Each entry is bounded for Pi chat context:

- `why promising` — short rationale from votes, comments, and comment signals (bounded to 120 characters)
- `launch timing` — featured or created date when available
- `next url` — Product Hunt post URL to inspect next

Example:

```txt
producthunt_topic_watchlist({ query: "AI coding agent", limit: 5 })
```

```markdown
## Topic watchlist: AI coding agent

1. AI Tool (ai-tool)
   - why promising: 100 votes and 12 comments; commenters ask about pricing; topics: AI, Developer Tools
   - launch timing: Featured 2026-06-01
   - next url: https://www.producthunt.com/posts/ai-tool
```

## How ranking works

Watchlist entries are ranked by a weighted score: `votes + comments × 3 + comment_signals × 2 + signal_bonus`. The signal bonus rewards posts whose comments mention pricing, strong interest keywords (`love`, `great`, `awesome`, `interested`, `need this`, `useful`), or active questions. The top 5 entries are returned.

## Comment signals

The rationale field includes one of these comment-level signals when comments are available:

- `commenters ask about pricing` — pricing, subscription, or cost keywords detected
- `positive launch reactions in comments` — love/great/awesome/need this signals
- `active questions in the thread` — how/when/support questions or question marks
- `comment thread worth sampling` — comments exist but none of the above patterns were found

If no comments were collected, only vote/comment counts and topics appear in the rationale.

## Bounded rationale

The `why promising` field is capped at 120 characters. When topics produce a long list, the field is truncated with an ellipsis (`…`). This keeps the watchlist compact for Pi chat context and vault notes.

## Search pool

Watchlist queries scan the top 20 ranked Product Hunt posts by default. Use the optional `searchPool` parameter to scan a wider pool (max 100) when the topic is narrow and the default pool returns too few matches. Note that the Product Hunt API has a query complexity cap; large search pools may be rejected.

## Read-only behavior

Watchlist output is generated locally from Product Hunt API reads. It does not bookmark, upvote, or mutate anything on Product Hunt.
