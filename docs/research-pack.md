# Research pack product cards

Pi Product Hunt can emit **bounded markdown product cards** when you want paste-ready launch snippets inside vault research notes.

## When to use each output

| Output | Best for | Includes |
|---|---|---|
| `producthunt_research_product_cards` / `/producthunt:cards` | Paste launch cards into notes | Compact per-product cards with launch fields |
| `producthunt_topic_watchlist` / `/producthunt:watchlist` | Revisit shortlist only | Up to 5 products with bounded rationale |
| `producthunt_research_topic` / `/producthunt:research` | Market or competitor research | Post details, comment signals, synthesis prompts, watchlist |
| `producthunt_digest` / `/producthunt:digest` | Daily launch note material | Top launches, signals scaffold, reactions scaffold, watchlist |

Use product cards when you already ran a research topic and want stable note blocks without hand-reformatting tool output or copying raw `details` JSON. Use the full research pack when you still need comment evidence and synthesis prompts. Use the watchlist when ranking and revisit rationale matter more than per-launch note blocks.

## Card fields

Each card is bounded for Pi chat context and vault notes:

- `tagline` — quoted one-liner
- `votes` / `comments` — launch engagement counts
- `launch` — featured or created date when available
- `topics` — Product Hunt topic labels
- `signal` — one bounded comment-theme line when comments were collected
- `url` — Product Hunt post URL

## Example

```txt
producthunt_research_product_cards({ query: "AI coding agent", limit: 5 })
```

```markdown
# Product Hunt cards: AI coding agent

### AI Tool (ai-tool)

> Build faster

- votes: 100, comments: 12
- launch: Featured 2026-06-01
- topics: AI
- signal: commenters ask about pricing
- url: https://www.producthunt.com/posts/ai-tool
```

## Read-only behavior

Product card output is generated locally from Product Hunt API reads. It does not write files, render HTML, or mutate anything on Product Hunt.
