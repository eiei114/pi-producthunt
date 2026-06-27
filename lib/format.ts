import type { CommentSummary, PostCommentsResult, PostConnectionResult, PostDetails, PostListItem, ResearchTopicResult, ViewerResult, WatchlistEntry } from "./types.ts";
import { deriveWatchlistEntries } from "./watchlist.ts";

const DEFAULT_MAX_CHARS = 16_000;

export function formatStatus(result: ViewerResult): string {
  const viewer = result.username ? `@${result.username}` : "token valid; no viewer returned for this token scope";
  return truncateMarkdown(`Product Hunt API status: ${viewer}${formatRateLimit(result.rateLimit)}`);
}

export function formatPostList(title: string, result: PostConnectionResult): string {
  const lines = [`# ${title}`, ""];
  if (result.posts.length === 0) {
    lines.push("No Product Hunt posts found.");
    return lines.join("\n");
  }

  result.posts.forEach((post, index) => {
    lines.push(`${index + 1}. ${formatPostHeadline(post)}`);
    lines.push(`   - ${post.tagline ?? "No tagline"}`);
    lines.push(`   - votes: ${post.votesCount ?? "?"}, comments: ${post.commentsCount ?? "?"}`);
    lines.push(`   - slug: ${post.slug}`);
    if (post.url) lines.push(`   - url: ${post.url}`);
    if (post.topics.length) lines.push(`   - topics: ${post.topics.map((topic) => topic.name).join(", ")}`);
  });

  lines.push(formatRateLimit(result.rateLimit));
  return truncateMarkdown(lines.join("\n"));
}

export function formatPostDetails(post: PostDetails): string {
  const lines = [`# ${post.name}`, ""];
  lines.push(post.tagline ?? "No tagline");
  lines.push("");
  if (post.description) lines.push(post.description, "");
  lines.push(`- slug: ${post.slug}`);
  lines.push(`- votes: ${post.votesCount ?? "?"}`);
  lines.push(`- comments: ${post.commentsCount ?? "?"}`);
  if (post.featuredAt) lines.push(`- featured: ${post.featuredAt}`);
  if (post.url) lines.push(`- Product Hunt: ${post.url}`);
  if (post.website) lines.push(`- website: ${post.website}`);
  if (post.topics.length) lines.push(`- topics: ${post.topics.map((topic) => topic.name).join(", ")}`);
  if (post.makers.length) lines.push(`- makers: ${post.makers.map(formatMaker).join(", ")}`);
  return truncateMarkdown(lines.join("\n"));
}

export function formatComments(result: PostCommentsResult): string {
  const lines = [`# Comments: ${result.post.name}`, ""];
  if (!result.comments.length) {
    lines.push("No comments found.");
    return lines.join("\n");
  }

  result.comments.forEach((comment, index) => {
    lines.push(`## ${index + 1}. ${comment.user ? formatMaker(comment.user) : "Unknown user"}`);
    lines.push(`votes: ${comment.votesCount ?? "?"}, replies: ${comment.repliesCount ?? 0}`);
    lines.push("");
    lines.push(stripHtml(comment.body));
    lines.push("");
  });

  lines.push(formatRateLimit(result.rateLimit));
  return truncateMarkdown(lines.join("\n"));
}

export function formatDigest(date: string, result: ResearchTopicResult | PostConnectionResult): string {
  const posts = "query" in result ? result.posts : result.posts;
  const lines = [`# Product Hunt Digest ${date}`, ""];
  lines.push("## Top launches");
  posts.forEach((post, index) => {
    lines.push(`${index + 1}. ${formatPostHeadline(post)}`);
    lines.push(`   - tagline: ${post.tagline ?? ""}`);
    lines.push(`   - votes: ${post.votesCount ?? "?"}, comments: ${post.commentsCount ?? "?"}`);
    lines.push(`   - url: ${post.url ?? `https://www.producthunt.com/posts/${post.slug}`}`);
    lines.push("   - why notable: ");
    const comments = getInlineComments(post);
    if (comments.length) {
      lines.push("   - reaction samples:");
      comments.slice(0, 3).forEach((comment) => {
        lines.push(`     - ${truncateLine(stripHtml(comment.body), 180)}`);
      });
    }
  });

  lines.push("", "## Signals", "- AI:", "- DevTools:", "- Consumer:", "- Design:", "- Productivity:");
  lines.push("", "## User reactions", "- Praise:", "- Complaints:", "- Questions:", "- Pricing concerns:");
  lines.push("", formatWatchlistSection(deriveWatchlistEntries({ query: date, posts })));
  return truncateMarkdown(lines.join("\n"));
}

function getInlineComments(post: PostListItem | (PostListItem & { comments?: CommentSummary[] })): CommentSummary[] {
  const maybeComments = (post as { comments?: unknown }).comments;
  return Array.isArray(maybeComments) ? (maybeComments as CommentSummary[]) : [];
}

export function formatResearch(result: ResearchTopicResult): string {
  const lines = [`# Product Hunt Research: ${result.query}`, ""];
  if (!result.posts.length) {
    lines.push("No matching posts found in the current ranking pool.", "");
    lines.push(formatWatchlistSection([], result.query));
    return truncateMarkdown(lines.join("\n"));
  }

  result.posts.forEach((post, index) => {
    lines.push(`## ${index + 1}. ${formatPostHeadline(post)}`);
    lines.push(post.tagline ?? "");
    lines.push(`votes: ${post.votesCount ?? "?"}, comments: ${post.commentsCount ?? "?"}`);
    lines.push(`url: ${post.url ?? `https://www.producthunt.com/posts/${post.slug}`}`);
    if (post.topics.length) lines.push(`topics: ${post.topics.map((topic) => topic.name).join(", ")}`);
    if (post.comments?.length) {
      lines.push("", "### Comment signals");
      post.comments.forEach((comment) => lines.push(`- ${truncateLine(stripHtml(comment.body), 220)}`));
    }
    lines.push("");
  });

  lines.push("## Synthesis prompts", "- Shared positioning pattern:", "- Repeated complaint:", "- Underserved user:", "- Follow-up searches:");
  lines.push("", formatWatchlistSection(deriveWatchlistEntries(result), result.query));
  return truncateMarkdown(lines.join("\n"));
}

export function formatTopicWatchlist(result: ResearchTopicResult, maxEntries?: number): string {
  const entries = deriveWatchlistEntries(result, maxEntries);
  return truncateMarkdown(formatWatchlistSection(entries, result.query));
}

export function formatWatchlistSection(entries: WatchlistEntry[], query?: string): string {
  const lines = [query ? `## Topic watchlist: ${query}` : "## Topic watchlist", ""];
  if (!entries.length) {
    lines.push("No promising products to watch yet.");
    return lines.join("\n");
  }

  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.name} (${entry.slug})`);
    lines.push(`   - why promising: ${entry.whyPromising}`);
    lines.push(`   - launch timing: ${entry.launchTiming}`);
    lines.push(`   - next url: ${entry.nextUrl}`);
  });

  return lines.join("\n");
}

export function truncateMarkdown(markdown: string, maxChars = DEFAULT_MAX_CHARS): string {
  if (markdown.length <= maxChars) return markdown;
  return `${markdown.slice(0, maxChars)}\n\n[Truncated: ${markdown.length - maxChars} chars omitted]`;
}

function formatPostHeadline(post: PostListItem): string {
  return `${post.name} (${post.slug})`;
}

function formatMaker(maker: { name: string; username?: string | null }): string {
  return maker.username ? `${maker.name} (@${maker.username})` : maker.name;
}

function formatRateLimit(rateLimit: { limit?: string; remaining?: string; reset?: string } | undefined): string {
  if (!rateLimit?.remaining) return "";
  return `\n\nRate limit: ${rateLimit.remaining}/${rateLimit.limit ?? "?"} remaining, reset ${rateLimit.reset ?? "?"}s`;
}

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function truncateLine(text: string, maxChars: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxChars) return singleLine;
  return `${singleLine.slice(0, maxChars - 1)}…`;
}

