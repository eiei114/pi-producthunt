import assert from "node:assert/strict";
import test from "node:test";

const { stripUtmFromProductHuntUrl, displayProductHuntUrl } = await import("../lib/urls.ts");

test("stripUtmFromProductHuntUrl removes utm_* params from Product Hunt URLs", () => {
  const input = "https://www.producthunt.com/posts/ai-tool?utm_source=newsletter&utm_medium=email&utm_campaign=launch&ref=home";
  const output = stripUtmFromProductHuntUrl(input);
  assert.equal(output, "https://www.producthunt.com/posts/ai-tool?ref=home");
});

test("stripUtmFromProductHuntUrl handles mixed-case utm param names", () => {
  const input = "https://www.producthunt.com/posts/ai-tool?UTM_SOURCE=newsletter&Utm_Campaign=launch&ref=home";
  const output = stripUtmFromProductHuntUrl(input);
  assert.equal(output, "https://www.producthunt.com/posts/ai-tool?ref=home");
});

test("stripUtmFromProductHuntUrl removes utm params when no other query params remain", () => {
  const input = "https://www.producthunt.com/posts/ai-tool?utm_source=newsletter&utm_medium=email";
  const output = stripUtmFromProductHuntUrl(input);
  assert.equal(output, "https://www.producthunt.com/posts/ai-tool");
});

test("stripUtmFromProductHuntUrl leaves non-Product Hunt URLs unchanged", () => {
  const input = "https://example.com/posts/ai-tool?utm_source=newsletter";
  assert.equal(stripUtmFromProductHuntUrl(input), input);
});

test("stripUtmFromProductHuntUrl leaves clean Product Hunt URLs unchanged", () => {
  const input = "https://www.producthunt.com/posts/ai-tool";
  assert.equal(stripUtmFromProductHuntUrl(input), input);
});

test("displayProductHuntUrl strips utm params", () => {
  assert.equal(
    displayProductHuntUrl(
      "https://www.producthunt.com/posts/ai-tool?utm_source=newsletter&utm_campaign=foo",
      "ai-tool",
    ),
    "https://www.producthunt.com/posts/ai-tool",
  );
});

test("displayProductHuntUrl falls back to the slug URL for missing or blank links", () => {
  for (const input of [null, undefined, "", " \t\n"]) {
    assert.equal(
      displayProductHuntUrl(input, "ai-tool"),
      "https://www.producthunt.com/posts/ai-tool",
      `input: ${JSON.stringify(input)}`,
    );
  }
});

test("displayProductHuntUrl preserves nonblank links that do not need cleanup", () => {
  const input = " https://example.com/posts/ai-tool?utm_source=newsletter ";
  assert.equal(displayProductHuntUrl(input, "ai-tool"), input);
});
