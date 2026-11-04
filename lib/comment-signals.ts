import type { CommentSummary } from "./types.ts";
import { stripHtml } from "./text.ts";

export const COMMENT_SIGNAL_LABELS = {
  pricing: "commenters ask about pricing",
  positive: "positive launch reactions in comments",
  question: "active questions in the thread",
} as const;

export type CommentSignalKind = keyof typeof COMMENT_SIGNAL_LABELS | "none";

const FALLBACK_SIGNAL_LABEL = "comment thread worth sampling";

const SIGNAL_WEIGHTS: Record<CommentSignalKind, number> = {
  pricing: 4,
  positive: 2,
  question: 1,
  none: 0,
};

const PRICING_PATTERN = /\b(pricing|price|cost|subscription|plan)s?\b/;
const POSITIVE_PATTERN = /\b(love|great|awesome|interested|need this|useful)\b/;
const QUESTION_PATTERN = /\b(question|how|when|support)\b|\?/;

interface CommentSignalAnalysis {
  kind: CommentSignalKind;
  weight: number;
  hasComments: boolean;
}

export function classifyCommentText(text: string): CommentSignalKind {
  if (!text) return "none";
  if (PRICING_PATTERN.test(text)) return "pricing";
  if (POSITIVE_PATTERN.test(text)) return "positive";
  if (QUESTION_PATTERN.test(text)) return "question";
  return "none";
}

export function classifyComments(comments: CommentSummary[]): CommentSignalKind {
  return analyzeComments(comments).kind;
}

export function analyzeCommentSignals(comments: CommentSummary[]): {
  kind: CommentSignalKind;
  weight: number;
  label: string;
} {
  const analysis = analyzeComments(comments);
  return {
    kind: analysis.kind,
    weight: analysis.weight,
    label: signalLabel(analysis.kind, analysis.hasComments),
  };
}

export function commentSignalWeight(comment: CommentSummary): number {
  return SIGNAL_WEIGHTS[classifyCommentText(normalizeCommentBody(comment))];
}

export function summarizeCommentSignalLabel(
  comments: CommentSummary[],
  fallback = FALLBACK_SIGNAL_LABEL,
): string {
  const analysis = analyzeComments(comments);
  return signalLabel(analysis.kind, analysis.hasComments, fallback);
}

/**
 * Single pass over a comment set: normalizes each body once, keeps the same
 * pricing > positive > question priority, and accumulates the shared weights.
 */
function analyzeComments(comments: CommentSummary[]): CommentSignalAnalysis {
  const analysis: CommentSignalAnalysis = {
    kind: "none",
    weight: 0,
    hasComments: comments.length > 0,
  };

  for (const comment of comments) {
    const kind = classifyCommentText(normalizeCommentBody(comment));
    if (kind === "none") continue;

    analysis.weight += SIGNAL_WEIGHTS[kind];
    if (kind === "pricing") {
      analysis.kind = "pricing";
    } else if (kind === "positive") {
      if (analysis.kind !== "pricing") analysis.kind = "positive";
    } else if (analysis.kind === "none") {
      analysis.kind = "question";
    }
  }

  return analysis;
}

function normalizeCommentBody(comment: CommentSummary): string {
  return stripHtml(comment.body).toLowerCase();
}

function signalLabel(
  kind: CommentSignalKind,
  hasComments: boolean,
  fallback = FALLBACK_SIGNAL_LABEL,
): string {
  if (kind !== "none") return COMMENT_SIGNAL_LABELS[kind];
  return hasComments ? fallback : "";
}
