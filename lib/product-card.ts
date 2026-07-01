import type { CommentSummary, PostListItem, ResearchTopicResult } from "./types.ts";

export const MAX_PRODUCT_CARD_TAGLINE_CHARS = 120;
export const MAX_PRODUCT_CARD_SIGNAL_CHARS = 100;

export type ProductCardPost = PostListItem & { comments?: CommentSummary[] };

export function formatProductCard(post: ProductCardPost): string {
  const lines = [`### ${post.name} (${post.slug})`, ""];

  const tagline = truncateField(post.tagline ?? "No tagline", MAX_PRODUCT_CARD_TAGLINE_CHARS);
  lines.push(`> ${tagline}`, "");

  lines.push(`- votes: ${post.votesCount ?? "?"}, comments: ${post.commentsCount ?? "?"}`);
  lines.push(`- launch: ${formatLaunchTiming(post)}`);

  if (post.topics.length) {
    lines.push(`- topics: ${post.topics.map((topic) => topic.name).join(", ")}`);
  }

  const signal = summarizeCommentSignal(post.comments ?? []);
  if (signal) lines.push(`- signal: ${signal}`);

  lines.push(`- url: ${post.url ?? `https://www.producthunt.com/posts/${post.slug}`}`);

  return lines.join("\n");
}

export function formatProductCards(
  result: ResearchTopicResult | { query: string; posts: ProductCardPost[] },
): string {
  const lines = [`# Product Hunt cards: ${result.query}`, ""];

  if (!result.posts.length) {
    lines.push("No matching launches to export as product cards.");
    return lines.join("\n");
  }

  result.posts.forEach((post, index) => {
    if (index > 0) lines.push("", "---", "");
    lines.push(formatProductCard(post));
  });

  return lines.join("\n");
}

function formatLaunchTiming(post: PostListItem): string {
  const featured = formatLaunchDate(post.featuredAt);
  if (featured) return `Featured ${featured}`;
  const created = formatLaunchDate(post.createdAt);
  if (created) return `Launched ${created}`;
  return "Launch date unavailable";
}

function formatLaunchDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function summarizeCommentSignal(comments: CommentSummary[]): string {
  const bodies = comments.map((comment) => stripHtml(comment.body).toLowerCase()).filter(Boolean);
  if (!bodies.length) return "";

  if (bodies.some((body) => /\b(pricing|price|cost|subscription|plan)s?\b/.test(body))) {
    return truncateField("commenters ask about pricing", MAX_PRODUCT_CARD_SIGNAL_CHARS);
  }
  if (bodies.some((body) => /\b(love|great|awesome|interested|need this|useful)\b/.test(body))) {
    return truncateField("positive launch reactions in comments", MAX_PRODUCT_CARD_SIGNAL_CHARS);
  }
  if (bodies.some((body) => /\b(question|how|when|support)\b|\?/.test(body))) {
    return truncateField("active questions in the thread", MAX_PRODUCT_CARD_SIGNAL_CHARS);
  }

  const sample = bodies[0]?.replace(/\s+/g, " ").trim();
  if (!sample) return "";
  return truncateField(sample, MAX_PRODUCT_CARD_SIGNAL_CHARS);
}

function truncateField(text: string, maxChars: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxChars) return singleLine;
  return `${singleLine.slice(0, maxChars - 1)}…`;
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
