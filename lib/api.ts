import { PRODUCTHUNT_GRAPHQL_ENDPOINT, getProductHuntToken, redactProductHuntToken } from "./config.ts";
import type { RateLimitInfo } from "./types.ts";

export class ProductHuntApiError extends Error {
  readonly status?: number;
  readonly rateLimit?: RateLimitInfo;
  readonly graphQLErrors?: unknown[];

  constructor(message: string, options: { status?: number; rateLimit?: RateLimitInfo; graphQLErrors?: unknown[] } = {}) {
    super(message);
    this.name = "ProductHuntApiError";
    this.status = options.status;
    this.rateLimit = options.rateLimit;
    this.graphQLErrors = options.graphQLErrors;
  }
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: unknown[];
}

export interface GraphQLResult<T> {
  data: T;
  rateLimit: RateLimitInfo;
}

export async function executeProductHuntGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { signal?: AbortSignal; token?: string } = {},
): Promise<GraphQLResult<T>> {
  const token = options.token ?? getProductHuntToken();

  const response = await fetch(PRODUCTHUNT_GRAPHQL_ENDPOINT, {
    method: "POST",
    signal: options.signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const rateLimit = extractRateLimit(response.headers);
  const text = await response.text();
  let payload: GraphQLResponse<T> | undefined;

  try {
    payload = text ? (JSON.parse(text) as GraphQLResponse<T>) : undefined;
  } catch {
    throw new ProductHuntApiError(redactProductHuntToken(`Product Hunt returned non-JSON response: ${text}`, token), {
      status: response.status,
      rateLimit,
    });
  }

  if (!response.ok) {
    const message = formatGraphQLErrors(payload?.errors) || `Product Hunt request failed with HTTP ${response.status}`;
    throw new ProductHuntApiError(redactProductHuntToken(message, token), {
      status: response.status,
      rateLimit,
      graphQLErrors: payload?.errors,
    });
  }

  if (payload?.errors?.length) {
    throw new ProductHuntApiError(redactProductHuntToken(formatGraphQLErrors(payload.errors), token), {
      status: response.status,
      rateLimit,
      graphQLErrors: payload.errors,
    });
  }

  if (!payload || payload.data == null) {
    throw new ProductHuntApiError("Product Hunt response did not include data.", { status: response.status, rateLimit });
  }

  return { data: payload.data, rateLimit };
}

function extractRateLimit(headers: Headers): RateLimitInfo {
  return {
    limit: headers.get("x-rate-limit-limit") ?? undefined,
    remaining: headers.get("x-rate-limit-remaining") ?? undefined,
    reset: headers.get("x-rate-limit-reset") ?? undefined,
  };
}

function formatGraphQLErrors(errors: unknown[] | undefined): string {
  if (!errors?.length) return "";
  return errors
    .map((error) => {
      if (typeof error === "string") return error;
      if (isRecord(error)) {
        const description = error.error_description;
        const message = error.message;
        const code = error.error;
        return [code, description ?? message].filter((part): part is string => typeof part === "string").join(": ");
      }
      return JSON.stringify(error);
    })
    .join("; ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

