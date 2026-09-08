import assert from "node:assert/strict";
import test from "node:test";

const {
  classifyCommentText,
  classifyComments,
  commentSignalWeight,
  summarizeCommentSignalLabel,
} = await import("../lib/comment-signals.ts");
const { formatLaunchDate, formatLaunchTiming } = await import("../lib/launch-timing.ts");
const { stripHtml, truncateSingleLine } = await import("../lib/text.ts");

test("stripHtml decodes entities and preserves line breaks from br tags", () => {
  assert.equal(stripHtml("Great<br>tool &amp; launch"), "Great\ntool & launch");
  assert.equal(stripHtml("<p>Hello</p>"), "Hello");
});

test("truncateSingleLine collapses whitespace and adds ellipsis", () => {
  assert.equal(truncateSingleLine("  one   two  ", 20), "one two");
  assert.equal(truncateSingleLine("abcdefghijklmnopqrstuvwxyz", 10), "abcdefghi…");
});

test("formatLaunchDate accepts ISO timestamps and rejects invalid values", () => {
  assert.equal(formatLaunchDate("2026-06-01T10:00:00Z"), "2026-06-01");
  assert.equal(formatLaunchDate("not-a-date"), null);
  assert.equal(formatLaunchDate(null), null);
});

test("formatLaunchTiming prefers featuredAt over createdAt", () => {
  assert.equal(
    formatLaunchTiming({ featuredAt: "2026-06-01T10:00:00Z", createdAt: "2026-05-31T09:00:00Z" }),
    "Featured 2026-06-01",
  );
  assert.equal(
    formatLaunchTiming({ featuredAt: null, createdAt: "2026-05-31T09:00:00Z" }),
    "Launched 2026-05-31",
  );
  assert.equal(formatLaunchTiming({ featuredAt: null, createdAt: null }), "Launch date unavailable");
});

test("classifyCommentText prioritizes pricing over positive and question signals", () => {
  assert.equal(classifyCommentText("what is the pricing?"), "pricing");
  assert.equal(classifyCommentText("love this launch"), "positive");
  assert.equal(classifyCommentText("how does support work?"), "question");
  assert.equal(classifyCommentText("plain update"), "none");
});

test("classifyComments prioritizes pricing across the full comment set", () => {
  const comments = [
    { id: "c1", body: "love this launch", user: { name: "User" } },
    { id: "c2", body: "what is the pricing?", user: { name: "User" } },
  ];
  assert.equal(classifyComments(comments), "pricing");
});

test("summarizeCommentSignalLabel returns shared labels across formatters", () => {
  const comments = [{ id: "c1", body: "Need pricing details", user: { name: "User" } }];
  assert.equal(summarizeCommentSignalLabel(comments), "commenters ask about pricing");
  assert.equal(classifyComments(comments), "pricing");
  assert.equal(commentSignalWeight(comments[0]), 4);
});

test("summarizeCommentSignalLabel uses fallback only when comments exist without a signal", () => {
  assert.equal(summarizeCommentSignalLabel([]), "");
  assert.equal(
    summarizeCommentSignalLabel([{ id: "c1", body: "Thanks for sharing", user: { name: "User" } }]),
    "comment thread worth sampling",
  );
});
