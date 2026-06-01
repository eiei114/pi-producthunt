export interface PostIdentifier {
  id?: string;
  slug?: string;
}

export function normalizePostIdentifier(input: string): PostIdentifier {
  const raw = input.trim();
  if (!raw) throw new Error("Product Hunt post slug, ID, or URL is required.");

  const urlSlug = extractPostSlugFromUrl(raw);
  if (urlSlug) return { slug: urlSlug };

  if (/^\d+$/.test(raw)) return { id: raw };

  return { slug: raw.replace(/^@?posts\//, "").replace(/^\//, "") };
}

function extractPostSlugFromUrl(input: string): string | undefined {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return undefined;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const postIndex = segments.indexOf("posts");
  if (postIndex === -1) return undefined;

  const slug = segments[postIndex + 1];
  return slug ? decodeURIComponent(slug) : undefined;
}

export function dateRangeForDay(date: string): { postedAfter: string; postedBefore: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid date.");

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    postedAfter: start.toISOString(),
    postedBefore: end.toISOString(),
  };
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function yesterdayIsoDate(now = new Date()): string {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

