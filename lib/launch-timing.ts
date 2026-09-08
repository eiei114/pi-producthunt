import type { PostListItem } from "./types.ts";

export function formatLaunchDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function formatLaunchTiming(post: Pick<PostListItem, "featuredAt" | "createdAt">): string {
  const featured = formatLaunchDate(post.featuredAt);
  if (featured) return `Featured ${featured}`;
  const created = formatLaunchDate(post.createdAt);
  if (created) return `Launched ${created}`;
  return "Launch date unavailable";
}
