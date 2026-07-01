import assert from "node:assert/strict";
import test from "node:test";

const { formatProductCard, formatProductCards } = await import("../lib/product-card.ts");
const { formatProductCards: formatProductCardsWrapped } = await import("../lib/format.ts");

const post = {
  id: "1",
  slug: "ai-tool",
  name: "AI Tool",
  tagline: "Build faster",
  url: "https://www.producthunt.com/posts/ai-tool",
  votesCount: 100,
  commentsCount: 12,
  featuredAt: "2026-06-01T10:00:00Z",
  createdAt: "2026-06-01T09:00:00Z",
  topics: [{ name: "AI", slug: "artificial-intelligence" }],
};

test("formatProductCard renders one bounded launch card", () => {
  const markdown = formatProductCard({
    ...post,
    comments: [{ id: "c1", body: "I need pricing details", user: { name: "User" } }],
  });

  assert.match(markdown, /### AI Tool \(ai-tool\)/);
  assert.match(markdown, /> Build faster/);
  assert.match(markdown, /votes: 100, comments: 12/);
  assert.match(markdown, /launch: Featured 2026-06-01/);
  assert.match(markdown, /topics: AI/);
  assert.match(markdown, /signal: commenters ask about pricing/);
  assert.match(markdown, /url: https:\/\/www\.producthunt\.com\/posts\/ai-tool/);
  assert.doesNotMatch(markdown, /Comment signals/);
});

test("formatProductCards renders multiple cards with separators", () => {
  const markdown = formatProductCards({
    query: "AI coding agent",
    posts: [
      post,
      {
        ...post,
        id: "2",
        slug: "runner-up",
        name: "Runner Up",
        url: "https://www.producthunt.com/posts/runner-up",
        votesCount: 20,
        commentsCount: 2,
      },
    ],
  });

  assert.match(markdown, /# Product Hunt cards: AI coding agent/);
  assert.match(markdown, /### AI Tool \(ai-tool\)/);
  assert.match(markdown, /### Runner Up \(runner-up\)/);
  assert.match(markdown, /---/);
});

test("formatProductCards handles empty results", () => {
  const markdown = formatProductCards({ query: "obscure niche", posts: [] });
  assert.match(markdown, /# Product Hunt cards: obscure niche/);
  assert.match(markdown, /No matching launches to export as product cards/);
});

test("formatProductCards wrapper applies global truncation guard", () => {
  const markdown = formatProductCardsWrapped({ query: "AI", posts: [post] });
  assert.match(markdown, /### AI Tool \(ai-tool\)/);
});
