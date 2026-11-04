import assert from "node:assert/strict";
import test from "node:test";

const {
  COMMENT_SIGNAL_LABELS,
  analyzeCommentSignals,
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

test("analyzeCommentSignals matches the classify, weight, and label seams", () => {
  const comments = [
    { id: "c1", body: "how does support work?", user: { name: "User" } },
    { id: "c2", body: "love this launch", user: { name: "User" } },
    { id: "c3", body: "what is the pricing?", user: { name: "User" } },
    { id: "c4", body: "plain update", user: { name: "User" } },
  ];

  const analysis = analyzeCommentSignals(comments);
  assert.equal(analysis.kind, "pricing");
  assert.equal(analysis.kind, classifyComments(comments));
  assert.equal(analysis.label, summarizeCommentSignalLabel(comments));
  assert.equal(analysis.label, COMMENT_SIGNAL_LABELS.pricing);
  assert.equal(
    analysis.weight,
    comments.reduce((total, comment) => total + commentSignalWeight(comment), 0),
    "aggregate weight must equal the sum of the per-comment weights",
  );
  assert.equal(analysis.weight, 7);
});

test("analyzeCommentSignals keeps priority and weights independent of comment order", () => {
  const pricey = { id: "c1", body: "Is there a subscription plan?", user: { name: "User" } };
  const positive = { id: "c2", body: "Need this today", user: { name: "User" } };
  const question = { id: "c3", body: "When is launch?", user: { name: "User" } };

  const forward = analyzeCommentSignals([pricey, positive, question]);
  const reversed = analyzeCommentSignals([question, positive, pricey]);

  assert.equal(forward.kind, "pricing");
  assert.equal(reversed.kind, "pricing");
  assert.equal(forward.weight, reversed.weight);
  assert.equal(forward.label, reversed.label);
});

test("analyzeCommentSignals reports the sampling fallback only for signal-free comments", () => {
  assert.deepEqual(analyzeCommentSignals([]), {
    kind: "none",
    weight: 0,
    label: "",
  });

  const neutral = analyzeCommentSignals([{ id: "c1", body: "Thanks for sharing", user: { name: "User" } }]);
  assert.equal(neutral.kind, "none");
  assert.equal(neutral.weight, 0);
  assert.equal(neutral.label, "comment thread worth sampling");
});

test("analyzeCommentSignals normalizes HTML escaping like the other seams", () => {
  const comments = [{ id: "c1", body: "Great<br>What is the pricing?", user: { name: "User" } }];

  const analysis = analyzeCommentSignals(comments);
  assert.equal(analysis.kind, classifyCommentText("great what is the pricing?"));
  assert.equal(analysis.kind, "pricing");
  assert.equal(analysis.weight, commentSignalWeight(comments[0]));
});

test("commentSignalWeight classifies one comment through the shared normalizer and classifier", () => {
  // The set-level helpers share one pass; the single-comment helper is not part
  // of that pass, but it must still reuse the same normalization and priority
  // rules, so its weight always agrees with the shared classifier.
  const cases = [
    { comment: { id: "c1", body: "  WHAT IS THE PRICING?  ", user: { name: "User" } }, expected: 4 },
    { comment: { id: "c2", body: "LOVE<br>this launch", user: { name: "User" } }, expected: 2 },
    { comment: { id: "c3", body: "How does support work?", user: { name: "User" } }, expected: 1 },
    { comment: { id: "c4", body: "plain update", user: { name: "User" } }, expected: 0 },
  ];

  for (const { comment, expected } of cases) {
    assert.equal(commentSignalWeight(comment), expected);
    // A one-comment set exercises the shared pass on the same body.
    assert.equal(commentSignalWeight(comment), analyzeCommentSignals([comment]).weight);
  }
});
