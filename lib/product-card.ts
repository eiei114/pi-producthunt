import type { CommentSummary, PostListItem, ResearchTopicResult } from "./types.ts";
import { summarizeCommentSignalLabel } from "./comment-signals.ts";
import { formatLaunchTiming } from "./launch-timing.ts";
import { stripHtml, truncateSingleLine } from "./text.ts";
import { displayProductHuntUrl } from "./urls.ts";

export const MAX_PRODUCT_CARD_TAGLINE_CHARS = 120;
export const MAX_PRODUCT_CARD_SIGNAL_CHARS = 100;

export type ProductCardPost = PostListItem & { comments?: CommentSummary[] };

export function formatProductCard(post: ProductCardPost): string {
  const lines = [`### ${post.name} (${post.slug})`, ""];

  const tagline = truncateSingleLine(post.tagline ?? "No tagline", MAX_PRODUCT_CARD_TAGLINE_CHARS);
  lines.push(`> ${tagline}`, "");

  lines.push(`- votes: ${post.votesCount ?? "?"}, comments: ${post.commentsCount ?? "?"}`);
  lines.push(`- launch: ${formatLaunchTiming(post)}`);

  if (post.topics.length) {
    lines.push(`- topics: ${post.topics.map((topic) => topic.name).join(", ")}`);
  }

  const signal = summarizeCommentSignal(post.comments ?? []);
  if (signal) lines.push(`- signal: ${signal}`);

  lines.push(`- url: ${displayProductHuntUrl(post.url, post.slug)}`);

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

function summarizeCommentSignal(comments: CommentSummary[]): string {
  const label = summarizeCommentSignalLabel(comments, "");
  if (label) {
    return truncateSingleLine(label, MAX_PRODUCT_CARD_SIGNAL_CHARS);
  }

  const sample = comments
    .map((comment) => stripHtml(comment.body).toLowerCase())
    .find(Boolean)
    ?.replace(/\s+/g, " ")
    .trim();
  if (!sample) return "";
  return truncateSingleLine(sample, MAX_PRODUCT_CARD_SIGNAL_CHARS);
}
