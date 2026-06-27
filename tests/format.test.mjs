import assert from "node:assert/strict";
import test from "node:test";

const { formatComments, formatDigest, formatPostList, formatResearch, formatTopicWatchlist } = await import("../lib/format.ts");

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

test("formatPostList creates compact markdown", () => {
  const markdown = formatPostList("Title", { posts: [post] });
  assert.match(markdown, /# Title/);
  assert.match(markdown, /AI Tool/);
  assert.match(markdown, /votes: 100, comments: 12/);
});

test("formatComments strips html", () => {
  const markdown = formatComments({
    post: { id: "1", slug: "ai-tool", name: "AI Tool" },
    comments: [
      { id: "c1", body: "Great<br>tool &amp; launch", votesCount: 5, user: { name: "User", username: "user" } },
    ],
  });
  assert.match(markdown, /Great\ntool & launch/);
});

test("formatDigest includes populated watchlist section", () => {
  const markdown = formatDigest("2026-06-01", {
    query: "2026-06-01",
    posts: [{ ...post, comments: [{ id: "c1", body: "Love this", user: { name: "User" } }] }],
  });
  assert.match(markdown, /Product Hunt Digest 2026-06-01/);
  assert.match(markdown, /## Signals/);
  assert.match(markdown, /## Topic watchlist/);
  assert.match(markdown, /why promising:/);
});

test("formatResearch includes topic watchlist section", () => {
  const markdown = formatResearch({
    query: "AI",
    posts: [{ ...post, comments: [{ id: "c1", body: "I need pricing", user: { name: "User" } }] }],
  });
  assert.match(markdown, /Product Hunt Research: AI/);
  assert.match(markdown, /Comment signals/);
  assert.match(markdown, /I need pricing/);
  assert.match(markdown, /## Topic watchlist: AI/);
});

test("formatTopicWatchlist stays compact", () => {
  const markdown = formatTopicWatchlist({ query: "AI", posts: [post] });
  assert.ok(markdown.length < 600);
  assert.doesNotMatch(markdown, /Comment signals/);
});
