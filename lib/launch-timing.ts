import type { PostListItem } from "./types.ts";

export function formatLaunchDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month < 1 || month > 12 || day < 1) return null;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1] ? date : null;
}

export function formatLaunchTiming(post: Pick<PostListItem, "featuredAt" | "createdAt">): string {
  const featured = formatLaunchDate(post.featuredAt);
  if (featured) return `Featured ${featured}`;
  const created = formatLaunchDate(post.createdAt);
  if (created) return `Launched ${created}`;
  return "Launch date unavailable";
}
