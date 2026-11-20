import assert from "node:assert/strict";
import test from "node:test";

const response = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const post = (slug, { name, tagline, topics = [] }) => ({
  id: `id-${slug}`,
  slug,
  name,
  tagline,
  topics: { edges: topics.map((topic) => ({ node: { name: topic } })) },
});

const postsResponse = (posts) =>
  response({
    data: {
      posts: {
        edges: posts.map((node) => ({ node })),
        pageInfo: { hasNextPage: false, endCursor: null },
        totalCount: posts.length,
      },
    },
  });

async function withMockedFetch(mockFetch, run) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test("searchPosts matches names, taglines, and topic names case-insensitively", async () => {
  const posts = [
    post("name-match", { name: "AI Canvas", tagline: "Sketch faster" }),
    post("tagline-match", { name: "Quiet Notes", tagline: "An AI writing partner" }),
    post("topic-match", { name: "Build Better", tagline: "Ship with confidence", topics: ["AI & Machine Learning"] }),
    post("no-match", { name: "Local Photos", tagline: "A private gallery", topics: ["Design"] }),
  ];

  await withMockedFetch(async () => postsResponse(posts), async () => {
    const { searchPosts } = await import("../lib/client.ts");
    const result = await searchPosts({ query: "  aI  ", limit: 10 }, { token: "test-token" });

    assert.deepEqual(result.posts.map((item) => item.slug), ["name-match", "tagline-match", "topic-match"]);
  });
});

test("searchPosts uses searchPool for fetched candidates and limit for returned matches", async () => {
  const candidates = [
    post("first-match", { name: "AI launch one" }),
    post("second-match", { name: "AI launch two" }),
    post("third-match", { name: "AI launch three" }),
    post("outside-pool", { name: "AI launch four" }),
  ];
  let request;

  await withMockedFetch(async (_url, init) => {
    request = JSON.parse(init.body);
    const fetchedCandidates = candidates.slice(0, request.variables.first);
    return postsResponse(fetchedCandidates);
  }, async () => {
    const { searchPosts } = await import("../lib/client.ts");
    const result = await searchPosts({ query: "ai", searchPool: 3, limit: 2 }, { token: "test-token" });

    assert.equal(request.variables.first, 3);
    assert.deepEqual(result.posts.map((item) => item.slug), ["first-match", "second-match"]);
    assert.equal(result.totalCount, 2);
    assert.ok(!result.posts.some((item) => item.slug === "third-match"), "limit truncates matching fetched candidates");
    assert.ok(!result.posts.some((item) => item.slug === "outside-pool"));
  });
});

test("searchPosts forwards the cursor and clamps the requested candidate bound", async () => {
  let request;

  await withMockedFetch(async (_url, init) => {
    request = JSON.parse(init.body);
    return postsResponse([]);
  }, async () => {
    const { searchPosts } = await import("../lib/client.ts");
    await searchPosts({ query: "ai", searchPool: 500, after: "cursor-next-page" }, { token: "test-token" });

    assert.deepEqual(request.variables, { first: 100, after: "cursor-next-page" });
  });
});

test("searchPosts rejects a blank query without making a request", async () => {
  let requestCount = 0;

  await withMockedFetch(async () => {
    requestCount += 1;
    throw new Error("Unexpected fetch for a blank query");
  }, async () => {
    const { searchPosts } = await import("../lib/client.ts");

    await assert.rejects(searchPosts({ query: " \t\n " }, { token: "test-token" }), {
      message: "Search query is required.",
    });
    assert.equal(requestCount, 0);
  });
});

test("researchTopic fetches comments in bounded batches without changing result order or fallbacks", async () => {
  const previousToken = process.env.PRODUCTHUNT_ACCESS_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.PRODUCTHUNT_ACCESS_TOKEN = "test-token";

  const posts = Array.from({ length: 10 }, (_, index) => ({
    id: `id-${index}`,
    slug: `post-${index}`,
    name: `Product ${index}`,
    topics: { edges: [] },
  }));
  let activeRequests = 0;
  let maxConcurrentRequests = 0;
  const requestedSlugs = [];

  globalThis.fetch = async (_url, { body }) => {
    const request = JSON.parse(body);
    if (request.query.includes("ProductHuntSearchPosts")) {
      return response({ data: { posts: { edges: posts.map((node) => ({ node })) } } });
    }

    if (request.query.includes("ProductHuntPostComments")) {
      const slug = request.variables.postSlug;
      requestedSlugs.push(slug);
      activeRequests += 1;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 15));
      activeRequests -= 1;

      if (slug === "post-3") return response({ errors: [{ message: "temporary failure" }] }, 503);
      return response({
        data: {
          post: {
            id: `id-${slug.slice(5)}`,
            slug,
            name: `Product ${slug.slice(5)}`,
            comments: {
              edges: [{ node: { id: `comment-${slug}`, body: "Useful feedback" } }],
              pageInfo: { hasNextPage: false },
              totalCount: 1,
            },
          },
        },
      });
    }

    throw new Error("Unexpected Product Hunt query");
  };

  try {
    const { researchTopic } = await import("../lib/client.ts");
    const result = await researchTopic({ query: "product", limit: 10, searchPool: 10, commentsPerPost: 1 });

    assert.deepEqual(result.posts.map((post) => post.slug), posts.map((post) => post.slug));
    assert.equal(result.posts[3].comments, undefined, "failed comment lookups keep the original post");
    for (const post of result.posts.filter((item) => item.slug !== "post-3")) {
      assert.deepEqual(post.comments?.map((comment) => comment.body), ["Useful feedback"]);
    }
    assert.deepEqual(requestedSlugs.sort(), posts.map((post) => post.slug).sort());
    assert.equal(maxConcurrentRequests, 4);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.PRODUCTHUNT_ACCESS_TOKEN;
    else process.env.PRODUCTHUNT_ACCESS_TOKEN = previousToken;
  }
});
