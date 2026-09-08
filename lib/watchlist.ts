import type { CommentSummary, PostListItem, ResearchTopicResult, WatchlistEntry } from "./types.ts";
import { commentSignalWeight, summarizeCommentSignalLabel } from "./comment-signals.ts";
import { formatLaunchTiming } from "./launch-timing.ts";
import { truncateSingleLine } from "./text.ts";
import { displayProductHuntUrl } from "./urls.ts";

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
    launchTiming: formatLaunchTiming(post),
    nextUrl: displayProductHuntUrl(post.url, post.slug),
  }));
}

function scorePost(post: ScoredPost): number {
  const votes = post.votesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const commentSignals = post.comments?.length ?? 0;
  const signalBonus = (post.comments ?? []).reduce((sum, comment) => sum + commentSignalWeight(comment), 0);
  return votes + comments * 3 + commentSignals * 2 + signalBonus;
}

function buildWhyPromising(post: ScoredPost): string {
  const votes = post.votesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const signals = summarizeCommentSignalLabel(post.comments ?? []);

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

function truncateRationale(text: string): string {
  return truncateSingleLine(text, MAX_WATCHLIST_RATIONALE_CHARS);
}
