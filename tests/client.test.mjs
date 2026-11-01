import assert from "node:assert/strict";
import test from "node:test";

const response = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
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
