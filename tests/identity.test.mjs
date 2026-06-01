import assert from "node:assert/strict";
import test from "node:test";

const { dateRangeForDay, normalizePostIdentifier, todayIsoDate, yesterdayIsoDate } = await import("../lib/identity.ts");

test("normalizePostIdentifier accepts Product Hunt URLs", () => {
  assert.deepEqual(normalizePostIdentifier("https://www.producthunt.com/posts/example-product?ref=test"), {
    slug: "example-product",
  });
});

test("normalizePostIdentifier accepts numeric IDs", () => {
  assert.deepEqual(normalizePostIdentifier("12345"), { id: "12345" });
});

test("normalizePostIdentifier accepts slugs", () => {
  assert.deepEqual(normalizePostIdentifier("example-product"), { slug: "example-product" });
});

test("dateRangeForDay returns UTC day bounds", () => {
  assert.deepEqual(dateRangeForDay("2026-06-01"), {
    postedAfter: "2026-06-01T00:00:00.000Z",
    postedBefore: "2026-06-02T00:00:00.000Z",
  });
});

test("today and yesterday use UTC ISO dates", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");
  assert.equal(todayIsoDate(now), "2026-06-01");
  assert.equal(yesterdayIsoDate(now), "2026-05-31");
});

