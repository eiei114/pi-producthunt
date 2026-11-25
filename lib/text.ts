const HTML_TOKEN_PATTERN = /<br\s*\/?>|<[^>]+>|&(?:amp|lt|gt|quot|#39);/gi;

export function stripHtml(text: string): string {
  return text.replace(HTML_TOKEN_PATTERN, (token) => {
    if (token.slice(1, 3).toLowerCase() === "br") return "\n";
    if (token.startsWith("<")) return "";
    switch (token) {
      case "&amp;": return "&";
      case "&lt;": return "<";
      case "&gt;": return ">";
      case "&quot;": return '"';
      case "&#39;": return "'";
      default: return token;
    }
  }).trim();
}

export function truncateSingleLine(text: string, maxChars: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxChars) return singleLine;
  let prefix = singleLine.slice(0, maxChars - 1);
  const before = prefix.charCodeAt(prefix.length - 1);
  const after = singleLine.charCodeAt(prefix.length);
  // Move the cutoff before the pair if it falls between its UTF-16 code units.
  if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) {
    prefix = prefix.slice(0, -1);
  }
  return `${prefix}…`;
}
