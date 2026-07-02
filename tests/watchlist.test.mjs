import assert from "node:assert/strict";
import test from "node:test";

const { deriveWatchlistEntries } = await import("../lib/watchlist.ts");
const { formatTopicWatchlist, formatWatchlistSection } = await import("../lib/format.ts");

const basePost = {
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

test("deriveWatchlistEntries returns empty list for no posts", () => {
  const entries = deriveWatchlistEntries({ query: "AI", posts: [] });
  assert.deepEqual(entries, []);
});

test("formatTopicWatchlist handles empty results", () => {
  const markdown = formatTopicWatchlist({ query: "AI", posts: [] });
  assert.match(markdown, /Topic watchlist: AI/);
  assert.match(markdown, /No promising products to watch yet/);
});

test("formatWatchlistSection formats a single entry with rationale fields", () => {
  const markdown = formatWatchlistSection([
    {
      name: "AI Tool",
      slug: "ai-tool",
      whyPromising: "100 votes and 12 comments; commenters ask about pricing",
      launchTiming: "Featured 2026-06-01",
      nextUrl: "https://www.producthunt.com/posts/ai-tool",
    },
  ]);

  assert.match(markdown, /1\. AI Tool \(ai-tool\)/);
  assert.match(markdown, /why promising: 100 votes and 12 comments/);
  assert.match(markdown, /launch timing: Featured 2026-06-01/);
  assert.match(markdown, /next url: https:\/\/www\.producthunt\.com\/posts\/ai-tool/);
});

test("formatTopicWatchlist formats multiple ranked entries", () => {
  const markdown = formatTopicWatchlist({
    query: "AI",
    posts: [
      {
        ...basePost,
        slug: "runner-up",
        name: "Runner Up",
        url: "https://www.producthunt.com/posts/runner-up",
        votesCount: 20,
        commentsCount: 2,
      },
      {
        ...basePost,
        comments: [{ id: "c1", body: "What is the pricing?", user: { name: "User" } }],
      },
    ],
  });

  assert.match(markdown, /1\. AI Tool \(ai-tool\)/);
  assert.match(markdown, /2\. Runner Up \(runner-up\)/);
  assert.match(markdown, /commenters ask about pricing/);
});

test("deriveWatchlistEntries caps output to five entries", () => {
  const posts = Array.from({ length: 7 }, (_, index) => ({
    ...basePost,
    id: String(index + 1),
    slug: `tool-${index + 1}`,
    name: `Tool ${index + 1}`,
    url: `https://www.producthunt.com/posts/tool-${index + 1}`,
    votesCount: index + 1,
  }));

  const entries = deriveWatchlistEntries({ query: "AI", posts });
  assert.equal(entries.length, 5);
  assert.equal(entries[0].slug, "tool-7");
});

test("deriveWatchlistEntries truncates rationale with many topics", () => {
  const longTopicsPost = {
    ...basePost,
    topics: [
      { name: "Productivity", slug: "productivity" },
      { name: "Developer Tools", slug: "developer-tools" },
      { name: "Artificial Intelligence", slug: "ai" },
      { name: "Open Source", slug: "open-source" },
      { name: "SaaS", slug: "saas" },
    ],
  };

  const entries = deriveWatchlistEntries({ query: "long", posts: [longTopicsPost] });
  assert.equal(entries.length, 1);
  assert.ok(entries[0].whyPromising.length <= 125, "rationale should be bounded near MAX_WATCHLIST_RATIONALE_CHARS");
  assert.ok(entries[0].whyPromising.includes("topics:"), "rationale should include topics");
});

test("formatWatchlistSection entry with pre-truncated rationale stays compact", () => {
  const truncatedRationale = "100 votes and 12 comments; topics: Productivity, Developer Tools, Artificial Intelligence, Open Source, S…";
  const markdown = formatWatchlistSection([
    {
      name: "Long Tool",
      slug: "long-tool",
      whyPromising: truncatedRationale,
      launchTiming: "Launched 2026-06-01",
      nextUrl: "https://www.producthunt.com/posts/long-tool",
    },
  ]);

  assert.ok(markdown.includes("…"), "pre-truncated rationale preserves ellipsis");
  assert.ok(markdown.length < 600, "whole watchlist section stays compact");
});
