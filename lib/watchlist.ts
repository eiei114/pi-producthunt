import type { CommentSummary, PostListItem, ResearchTopicResult, WatchlistEntry } from "./types.ts";

export const DEFAULT_MAX_WATCHLIST_ENTRIES = 5;
export const MAX_WATCHLIST_RATIONALE_CHARS = 120;

type ScoredPost = PostListItem & { comments?: CommentSummary[] };

export function deriveWatchlistEntries(
  result: ResearchTopicResult | { query: string; posts: ScoredPost[] },
  maxEntries = DEFAULT_MAX_WATCHLIST_ENTRIES,
): WatchlistEntry[] {
  if (!result.posts.length) return [];

  const ranked = [...result.posts]
    .map((post) => ({ post, score: scorePost(post) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, maxEntries));

  return ranked.map(({ post }) => ({
    name: post.name,
    slug: post.slug,
    whyPromising: buildWhyPromising(post),
    launchTiming: buildLaunchTiming(post),
    nextUrl: post.url ?? `https://www.producthunt.com/posts/${post.slug}`,
  }));
}

function scorePost(post: ScoredPost): number {
  const votes = post.votesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const commentSignals = post.comments?.length ?? 0;
  const signalBonus = (post.comments ?? []).reduce((sum, comment) => sum + commentSignalWeight(comment), 0);
  return votes + comments * 3 + commentSignals * 2 + signalBonus;
}

function commentSignalWeight(comment: CommentSummary): number {
  const text = stripHtml(comment.body).toLowerCase();
  if (!text) return 0;
  if (/(pricing|price|cost|subscription|plan)/.test(text)) return 4;
  if (/(love|great|awesome|interested|need this|useful)/.test(text)) return 2;
  if (/(question|how|when|support)/.test(text)) return 1;
  return 0;
}

function buildWhyPromising(post: ScoredPost): string {
  const votes = post.votesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const signals = summarizeCommentSignals(post.comments ?? []);

  const parts: string[] = [];
  if (votes > 0 || comments > 0) {
    parts.push(`${votes} votes and ${comments} comments`);
  }
  if (signals) parts.push(signals);
  if (post.topics.length) {
    parts.push(`topics: ${post.topics.map((topic) => topic.name).join(", ")}`);
  }
  if (!parts.length) return "Matched the research query with limited public engagement so far.";
  return truncateRationale(parts.join("; "));
}

function summarizeCommentSignals(comments: CommentSummary[]): string {
  const bodies = comments.map((comment) => stripHtml(comment.body).toLowerCase()).filter(Boolean);
  if (!bodies.length) return "";

  if (bodies.some((body) => /(pricing|price|cost|subscription|plan)/.test(body))) {
    return "commenters ask about pricing";
  }
  if (bodies.some((body) => /(love|great|awesome|interested|need this|useful)/.test(body))) {
    return "positive launch reactions in comments";
  }
  if (bodies.some((body) => /(question|how|when|support)/.test(body))) {
    return "active questions in the thread";
  }
  return "comment thread worth sampling";
}

function buildLaunchTiming(post: ScoredPost): string {
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

function truncateRationale(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= MAX_WATCHLIST_RATIONALE_CHARS) return singleLine;
  return `${singleLine.slice(0, MAX_WATCHLIST_RATIONALE_CHARS - 1)}…`;
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
