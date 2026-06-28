import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { getPost, getPostComments, getPosts, researchTopic, searchPosts } from "../lib/client.ts";
import { getProductHuntAuthDiagnostics, validateProductHuntAccess } from "../lib/auth-diagnostics.ts";
import { PRODUCTHUNT_TOKEN_ENV, clearStoredAccessToken, saveStoredAccessToken } from "../lib/config.ts";
import { formatAuthStatusReport, formatComments, formatDigest, formatPostDetails, formatPostList, formatResearch, formatTopicWatchlist } from "../lib/format.ts";
import { deriveWatchlistEntries } from "../lib/watchlist.ts";
import { todayIsoDate, yesterdayIsoDate } from "../lib/identity.ts";
import { StringEnum } from "../lib/schema.ts";
import type { ResearchTopicResult } from "../lib/types.ts";

const emptyParameters = Type.Object({});

const limit = Type.Optional(Type.Integer({ description: "Maximum items to return", minimum: 1, maximum: 50 }));

const getPostsParameters = Type.Object({
  date: Type.Optional(Type.String({ description: "UTC date in YYYY-MM-DD format" })),
  topic: Type.Optional(Type.String({ description: "Product Hunt topic slug" })),
  featured: Type.Optional(Type.Boolean({ description: "Whether to request featured posts" })),
  order: Type.Optional(StringEnum(["RANKING", "NEWEST"], { description: "Product Hunt posts order" })),
  limit,
});

const searchPostsParameters = Type.Object({
  query: Type.String({ description: "Search keyword or phrase" }),
  limit,
  searchPool: Type.Optional(Type.Integer({ description: "Number of ranked posts to scan before filtering", minimum: 1, maximum: 100 })),
});

const postRefParameters = Type.Object({
  ref: Type.String({ description: "Product Hunt post slug, numeric ID, or Product Hunt post URL" }),
});

const commentsParameters = Type.Object({
  ref: Type.String({ description: "Product Hunt post slug, numeric ID, or Product Hunt post URL" }),
  limit,
  order: Type.Optional(StringEnum(["RANKING", "NEWEST"], { description: "Product Hunt comments order" })),
});

const researchParameters = Type.Object({
  query: Type.String({ description: "Research topic or keyword" }),
  limit,
  commentsPerPost: Type.Optional(Type.Integer({ description: "Comments to collect for each matched post", minimum: 0, maximum: 10 })),
});

const digestParameters = Type.Object({
  date: Type.Optional(Type.String({ description: "UTC date in YYYY-MM-DD format. Defaults to today." })),
  limit,
  commentsPerPost: Type.Optional(Type.Integer({ description: "Comments to collect for top posts", minimum: 0, maximum: 10 })),
});

export default function (pi: ExtensionAPI) {
  registerTools(pi);
  registerCommands(pi);
}

function registerTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "producthunt_status",
    label: "Product Hunt Status",
    description: "Check Product Hunt API authentication status, token source, and validation diagnostics",
    promptSnippet: "producthunt_status: check Product Hunt auth source and API validation",
    promptGuidelines: ["Use producthunt_status before Product Hunt research when authentication may be missing or stale."],
    parameters: emptyParameters,
    async execute(_toolCallId, _params, signal) {
      const diagnostics = getProductHuntAuthDiagnostics();
      const validation = await validateProductHuntAccess({ signal });
      const report = formatAuthStatusReport(diagnostics, validation);
      return {
        content: [{ type: "text", text: report }],
        details: { diagnostics, validation },
      };
    },
  });

  pi.registerTool({
    name: "producthunt_get_posts",
    label: "Product Hunt Posts",
    description: "Get Product Hunt posts by date, topic, featured flag, or order",
    promptSnippet: "producthunt_get_posts: fetch Product Hunt launch lists for trend scans",
    promptGuidelines: ["Use producthunt_get_posts for daily Product Hunt launch scans and digest source material."],
    parameters: getPostsParameters,
    async execute(_toolCallId, params, signal) {
      const result = await getPosts(params, { signal });
      return { content: [{ type: "text", text: formatPostList("Product Hunt Posts", result) }], details: result };
    },
  });

  pi.registerTool({
    name: "producthunt_search_posts",
    label: "Product Hunt Search",
    description: "Search ranked Product Hunt posts by product name, tagline, or topic",
    promptSnippet: "producthunt_search_posts: search Product Hunt launches by keyword",
    promptGuidelines: ["Use producthunt_search_posts for Product Hunt competitor or topic research."],
    parameters: searchPostsParameters,
    async execute(_toolCallId, params, signal) {
      const result = await searchPosts(params, { signal });
      return { content: [{ type: "text", text: formatPostList(`Product Hunt Search: ${params.query}`, result) }], details: result };
    },
  });

  pi.registerTool({
    name: "producthunt_get_post",
    label: "Product Hunt Post",
    description: "Get one Product Hunt post by slug, numeric ID, or Product Hunt URL",
    promptSnippet: "producthunt_get_post: inspect one Product Hunt post in detail",
    promptGuidelines: ["Use producthunt_get_post before summarizing a specific Product Hunt launch."],
    parameters: postRefParameters,
    async execute(_toolCallId, params, signal) {
      const post = await getPost(params.ref, { signal });
      return { content: [{ type: "text", text: formatPostDetails(post) }], details: post };
    },
  });

  pi.registerTool({
    name: "producthunt_get_post_comments",
    label: "Product Hunt Comments",
    description: "Get comments for one Product Hunt post by slug, numeric ID, or Product Hunt URL",
    promptSnippet: "producthunt_get_post_comments: collect user reactions from a Product Hunt post",
    promptGuidelines: ["Use producthunt_get_post_comments to extract praise, complaints, questions, and pricing concerns."],
    parameters: commentsParameters,
    async execute(_toolCallId, params, signal) {
      const result = await getPostComments(params, { signal });
      return { content: [{ type: "text", text: formatComments(result) }], details: result };
    },
  });

  pi.registerTool({
    name: "producthunt_research_topic",
    label: "Product Hunt Research",
    description: "Search Product Hunt and collect comment signals for a research topic",
    promptSnippet: "producthunt_research_topic: gather Product Hunt posts plus comments for research",
    promptGuidelines: ["Use producthunt_research_topic when the user asks for Product Hunt market, competitor, or trend research."],
    parameters: researchParameters,
    async execute(_toolCallId, params, signal) {
      const result = await researchTopic(params, { signal });
      return { content: [{ type: "text", text: formatResearch(result) }], details: result };
    },
  });

  pi.registerTool({
    name: "producthunt_topic_watchlist",
    label: "Product Hunt Topic Watchlist",
    description: "Create a compact watchlist of promising Product Hunt products for a research topic",
    promptSnippet: "producthunt_topic_watchlist: shortlist promising Product Hunt launches to revisit",
    promptGuidelines: [
      "Use producthunt_topic_watchlist when the user wants a short revisit list instead of a full research dump.",
      "Prefer producthunt_research_topic when the user needs comment signals and synthesis prompts.",
    ],
    parameters: researchParameters,
    async execute(_toolCallId, params, signal) {
      const result = await researchTopic(params, { signal });
      return { content: [{ type: "text", text: formatTopicWatchlist(result) }], details: { query: result.query, watchlist: deriveWatchlistEntries(result) } };
    },
  });

  pi.registerTool({
    name: "producthunt_digest",
    label: "Product Hunt Digest",
    description: "Create digest-ready Markdown for Product Hunt launches on a date",
    promptSnippet: "producthunt_digest: prepare Product Hunt daily digest source material",
    promptGuidelines: ["Use producthunt_digest when the user wants a Product Hunt daily digest or note material."],
    parameters: digestParameters,
    async execute(_toolCallId, params, signal) {
      const date = params.date ?? todayIsoDate();
      const digest = await buildDigest(date, params.limit ?? 10, params.commentsPerPost ?? 3, signal);
      return { content: [{ type: "text", text: formatDigest(date, digest) }], details: { date, ...digest } };
    },
  });
}

function registerCommands(pi: ExtensionAPI) {
  pi.registerCommand("producthunt:status", {
    description: "Check Product Hunt API authentication status, token source, and validation diagnostics",
    handler: async (_args, ctx) =>
      runCommand(pi, ctx, "status", async () => {
        const diagnostics = getProductHuntAuthDiagnostics();
        const validation = await validateProductHuntAccess({ signal: ctx.signal });
        return formatAuthStatusReport(diagnostics, validation);
      }),
  });

  pi.registerCommand("producthunt:login", {
    description: "Enter and store Product Hunt access token via Pi UI",
    handler: async (_args, ctx) => {
      const entered = await ctx.ui.input("Product Hunt access token:", "paste access token here");
      const accessToken = String(entered ?? "").trim();
      if (!accessToken) {
        ctx.ui.notify("Product Hunt token was not saved.", "warning");
        return;
      }

      saveStoredAccessToken(accessToken);
      ctx.ui.notify(
        "Saved Product Hunt token for pi-producthunt. The token was handled by the extension UI and not sent to the model.",
        "info",
      );
    },
  });

  pi.registerCommand("producthunt:logout", {
    description: "Remove stored Product Hunt access token from pi-producthunt auth file",
    handler: async (_args, ctx) => {
      clearStoredAccessToken();
      ctx.ui.notify(
        `${PRODUCTHUNT_TOKEN_ENV} environment variable is unchanged. Removed stored pi-producthunt token.`,
        "info",
      );
    },
  });

  pi.registerCommand("producthunt:today", {
    description: "Show today's Product Hunt launches",
    handler: async (_args, ctx) =>
      runCommand(pi, ctx, "today", async () => {
        const date = todayIsoDate();
        return formatPostList(`Product Hunt Today ${date}`, await getPosts({ date, limit: 10 }, { signal: ctx.signal }));
      }),
  });

  pi.registerCommand("producthunt:search", {
    description: "Interactively search Product Hunt posts",
    handler: async (_args, ctx) =>
      runCommand(pi, ctx, "search", async () => {
        const query = await requiredInput(ctx, "Product Hunt search", "Search keyword or phrase");
        return formatPostList(`Product Hunt Search: ${query}`, await searchPosts({ query, limit: 10, searchPool: 75 }, { signal: ctx.signal }));
      }),
  });

  pi.registerCommand("producthunt:post", {
    description: "Interactively inspect one Product Hunt post",
    handler: async (_args, ctx) =>
      runCommand(pi, ctx, "post", async () => {
        const ref = await requiredInput(ctx, "Product Hunt post", "Slug, ID, or URL");
        return formatPostDetails(await getPost(ref, { signal: ctx.signal }));
      }),
  });

  pi.registerCommand("producthunt:comments", {
    description: "Interactively collect Product Hunt post comments",
    handler: async (_args, ctx) =>
      runCommand(pi, ctx, "comments", async () => {
        const ref = await requiredInput(ctx, "Product Hunt comments", "Post slug, ID, or URL");
        return formatComments(await getPostComments({ ref, limit: 10 }, { signal: ctx.signal }));
      }),
  });

  pi.registerCommand("producthunt:digest", {
    description: "Create Product Hunt digest source material",
    handler: async (_args, ctx) =>
      runCommand(pi, ctx, "digest", async () => {
        const date = await chooseDate(ctx);
        return formatDigest(date, await buildDigest(date, 10, 3, ctx.signal));
      }),
  });

  pi.registerCommand("producthunt:watchlist", {
    description: "Interactively create a compact Product Hunt topic watchlist",
    handler: async (_args, ctx) =>
      runCommand(pi, ctx, "watchlist", async () => {
        const query = await requiredInput(ctx, "Product Hunt watchlist", "Research topic or keyword");
        return formatTopicWatchlist(await researchTopic({ query, limit: 5, commentsPerPost: 3 }, { signal: ctx.signal }));
      }),
  });

  pi.registerCommand("producthunt:research", {
    description: "Interactively research a Product Hunt topic",
    handler: async (_args, ctx) =>
      runCommand(pi, ctx, "research", async () => {
        const query = await requiredInput(ctx, "Product Hunt research", "Research topic or keyword");
        return formatResearch(await researchTopic({ query, limit: 5, commentsPerPost: 3 }, { signal: ctx.signal }));
      }),
  });
}

async function buildDigest(
  date: string,
  limit: number,
  commentsPerPost: number,
  signal: AbortSignal | undefined,
): Promise<ResearchTopicResult> {
  const posts = await getPosts({ date, limit, order: "RANKING" }, { signal });
  const withComments: ResearchTopicResult["posts"] = [];

  for (const post of posts.posts) {
    if (commentsPerPost <= 0) {
      withComments.push(post);
      continue;
    }

    try {
      const comments = await getPostComments({ ref: post.slug, limit: commentsPerPost }, { signal });
      withComments.push({ ...post, comments: comments.comments });
    } catch {
      withComments.push(post);
    }
  }

  return { query: date, posts: withComments, rateLimit: posts.rateLimit };
}

async function runCommand(pi: ExtensionAPI, ctx: ExtensionCommandContext, kind: string, work: () => Promise<string>) {
  try {
    const markdown = await work();
    pi.sendMessage({ customType: "producthunt", content: markdown, display: true, details: { kind } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`Product Hunt error: ${message}`, "error");
    pi.sendMessage({ customType: "producthunt", content: `Product Hunt error: ${message}`, display: true, details: { kind, error: true } });
  }
}

async function requiredInput(ctx: ExtensionCommandContext, title: string, placeholder: string): Promise<string> {
  if (!ctx.hasUI) throw new Error(`${title} requires interactive input.`);
  const input = await ctx.ui.input(title, placeholder);
  const value = input?.trim();
  if (!value) throw new Error("Input cancelled or empty.");
  return value;
}

async function chooseDate(ctx: ExtensionCommandContext): Promise<string> {
  if (!ctx.hasUI) return todayIsoDate();
  const choice = await ctx.ui.select("Product Hunt digest date", ["today", "yesterday", "custom"]);
  if (choice === "yesterday") return yesterdayIsoDate();
  if (choice === "custom") return requiredInput(ctx, "Product Hunt digest date", "YYYY-MM-DD");
  return todayIsoDate();
}
