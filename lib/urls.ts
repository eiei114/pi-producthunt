const PRODUCT_HUNT_HOSTS = new Set(["producthunt.com", "www.producthunt.com"]);

export function stripUtmFromProductHuntUrl(input: string | null | undefined): string | null | undefined {
  if (input == null || input === "") return input;

  try {
    const url = new URL(input);
    if (!PRODUCT_HUNT_HOSTS.has(url.hostname.toLowerCase())) return input;

    let changed = false;
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (!changed) return input;

    const serialized = url.toString();
    return url.search ? serialized : serialized.replace(/\?$/, "");
  } catch {
    return input;
  }
}

export function displayProductHuntUrl(url: string | null | undefined, slug: string): string {
  const cleaned = stripUtmFromProductHuntUrl(url);
  return cleaned ?? `https://www.producthunt.com/posts/${slug}`;
}
