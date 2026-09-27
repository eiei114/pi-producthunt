import type { CommentSummary } from "./types.ts";
import { stripHtml } from "./text.ts";

export const COMMENT_SIGNAL_LABELS = {
  pricing: "commenters ask about pricing",
  positive: "positive launch reactions in comments",
  question: "active questions in the thread",
} as const;

export type CommentSignalKind = keyof typeof COMMENT_SIGNAL_LABELS | "none";

const PRICING_PATTERN = /\b(pricing|price|cost|subscription|plan)s?\b/;
const POSITIVE_PATTERN = /\b(love|great|awesome|interested|need this|useful)\b/;
const QUESTION_PATTERN = /\b(question|how|when|support)\b|\?/;

export function classifyCommentText(text: string): CommentSignalKind {
  if (!text) return "none";
  if (PRICING_PATTERN.test(text)) return "pricing";
  if (POSITIVE_PATTERN.test(text)) return "positive";
  if (QUESTION_PATTERN.test(text)) return "question";
  return "none";
}

export function classifyComments(comments: CommentSummary[]): CommentSignalKind {
  let best: CommentSignalKind = "none";
  for (const comment of comments) {
    const kind = classifyCommentText(stripHtml(comment.body).toLowerCase());
    if (kind === "pricing") return kind;
    if (kind === "positive") best = "positive";
    else if (kind === "question" && best === "none") best = "question";
  }
  return best;
}

export function commentSignalWeight(comment: CommentSummary): number {
  const kind = classifyCommentText(stripHtml(comment.body).toLowerCase());
  switch (kind) {
    case "pricing":
      return 4;
    case "positive":
      return 2;
    case "question":
      return 1;
    default:
      return 0;
  }
}

export function summarizeCommentSignalLabel(
  comments: CommentSummary[],
  fallback = "comment thread worth sampling",
): string {
  const kind = classifyComments(comments);
  if (kind !== "none") return COMMENT_SIGNAL_LABELS[kind];
  return comments.length ? fallback : "";
}
