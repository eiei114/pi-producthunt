# Watchlist output

Pi Product Hunt can emit a compact **topic watchlist** when you want a short revisit list instead of rereading a full research dump.

## When to use each output

| Output | Best for | Includes |
|---|---|---|
| `producthunt_topic_watchlist` / `/producthunt:watchlist` | Revisit shortlist only | Up to 5 products with bounded rationale |
| `producthunt_research_topic` / `/producthunt:research` | Market or competitor research | Post details, comment signals, synthesis prompts, watchlist |
| `producthunt_digest` / `/producthunt:digest` | Daily launch note material | Top launches, signals scaffold, reactions scaffold, watchlist |

Use the watchlist when you already know the topic and only need promising products to inspect later. Use the full research pack when you still need comment evidence and synthesis prompts. Use the digest when the date matters more than the search query.

## Watchlist fields

Each entry is bounded for Pi chat context:

- `why promising` — short rationale from votes, comments, and comment signals
- `launch timing` — featured or created date when available
- `next url` — Product Hunt post URL to inspect next

Example:

```txt
producthunt_topic_watchlist({ query: "AI coding agent", limit: 5 })
```

```markdown
## Topic watchlist: AI coding agent

1. AI Tool (ai-tool)
   - why promising: 100 votes and 12 comments; commenters ask about pricing
   - launch timing: Featured 2026-06-01
   - next url: https://www.producthunt.com/posts/ai-tool
```

## Read-only behavior

Watchlist output is generated locally from Product Hunt API reads. It does not bookmark, upvote, or mutate anything on Product Hunt.
