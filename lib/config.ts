import { clearStoredAccessToken, inspectStoredAccessToken, loadStoredAccessToken, saveStoredAccessToken } from "./auth-store.ts";

export const PRODUCTHUNT_GRAPHQL_ENDPOINT = "https://api.producthunt.com/v2/api/graphql";
export const PRODUCTHUNT_TOKEN_ENV = "PRODUCTHUNT_ACCESS_TOKEN";

export type AccessTokenSource = "environment" | "stored" | "missing";

export interface ResolvedAccessToken {
  accessToken?: string;
  source: AccessTokenSource;
}

export function resolveProductHuntAccessToken(env: NodeJS.ProcessEnv = process.env): ResolvedAccessToken {
  const envValue = env[PRODUCTHUNT_TOKEN_ENV]?.trim();
  if (envValue) {
    return { accessToken: envValue, source: "environment" };
  }

  const stored = inspectStoredAccessToken();
  if (stored.loadable && stored.accessToken) {
    return { accessToken: stored.accessToken, source: "stored" };
  }

  return { source: "missing" };
}

export function getProductHuntToken(env: NodeJS.ProcessEnv = process.env): string {
  const token = resolveProductHuntAccessToken(env).accessToken;
  if (!token) {
    throw new Error(
      `${PRODUCTHUNT_TOKEN_ENV} is required. Run /producthunt:login or set the env var; do not commit Product Hunt tokens.`,
    );
  }
  return token;
}

export function isProductHuntConfigured(): boolean {
  return Boolean(resolveProductHuntAccessToken().accessToken);
}

export function redactProductHuntToken(text: string, token?: string): string {
  let redacted = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
  if (token) {
    redacted = redacted.split(token).join("[REDACTED]");
  }
  return redacted;
}

export { clearStoredAccessToken, loadStoredAccessToken, saveStoredAccessToken };

