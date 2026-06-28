import { inspectStoredAccessToken } from "./auth-store.ts";
import { getViewer } from "./client.ts";
import { PRODUCTHUNT_TOKEN_ENV, redactProductHuntToken, type AccessTokenSource } from "./config.ts";
import { ProductHuntApiError } from "./api.ts";
import type { RateLimitInfo } from "./types.ts";

export type AuthFailureCode =
  | "missing_token"
  | "auth_file_unreadable"
  | "stored_token_invalid"
  | "invalid_token"
  | "validation_failed";

export interface AuthFailureDiagnostic {
  code: AuthFailureCode;
  message: string;
  recovery: string[];
}

export interface ProductHuntAuthDiagnostics {
  configured: boolean;
  activeSource: AccessTokenSource;
  envTokenPresent: boolean;
  storedLoginPresent: boolean;
  storedLoginUsable: boolean;
  storedLoginShadowed: boolean;
  authFilePath: string;
  precedence: string;
  failure?: AuthFailureDiagnostic;
}

export interface AuthValidationResult {
  ok: boolean;
  username?: string;
  rateLimit?: RateLimitInfo;
  failure?: AuthFailureDiagnostic;
}

export function getProductHuntAuthDiagnostics(env: NodeJS.ProcessEnv = process.env): ProductHuntAuthDiagnostics {
  const envTokenPresent = Boolean(env[PRODUCTHUNT_TOKEN_ENV]?.trim());
  const stored = inspectStoredAccessToken();
  const storedLoginPresent = stored.fileExists;
  const storedLoginUsable = stored.loadable;
  const storedLoginShadowed = envTokenPresent && storedLoginUsable;

  const precedence = `${PRODUCTHUNT_TOKEN_ENV} takes priority over the stored login file at ${stored.filePath}.`;

  if (envTokenPresent) {
    return {
      configured: true,
      activeSource: "environment",
      envTokenPresent: true,
      storedLoginPresent,
      storedLoginUsable,
      storedLoginShadowed,
      authFilePath: stored.filePath,
      precedence,
    };
  }

  if (stored.loadable) {
    return {
      configured: true,
      activeSource: "stored",
      envTokenPresent: false,
      storedLoginPresent: true,
      storedLoginUsable: true,
      storedLoginShadowed: false,
      authFilePath: stored.filePath,
      precedence,
    };
  }

  const failure = buildStoredOrMissingFailure(stored);
  return {
    configured: false,
    activeSource: "missing",
    envTokenPresent: false,
    storedLoginPresent,
    storedLoginUsable: false,
    storedLoginShadowed: false,
    authFilePath: stored.filePath,
    precedence,
    failure,
  };
}

export async function validateProductHuntAccess(
  options: { signal?: AbortSignal; env?: NodeJS.ProcessEnv } = {},
): Promise<AuthValidationResult> {
  const diagnostics = getProductHuntAuthDiagnostics(options.env);
  if (!diagnostics.configured) {
    return { ok: false, failure: diagnostics.failure };
  }

  const token = resolveTokenForValidation(options.env);
  if (!token) {
    return {
      ok: false,
      failure: {
        code: "missing_token",
        message: "No Product Hunt access token is available.",
        recovery: missingTokenRecovery(),
      },
    };
  }

  try {
    const viewer = await getViewer({ signal: options.signal, token });
    return { ok: true, username: viewer.username, rateLimit: viewer.rateLimit };
  } catch (error) {
    return { ok: false, failure: classifyValidationError(error, token) };
  }
}

export function authStatusText(env: NodeJS.ProcessEnv = process.env): string {
  const diagnostics = getProductHuntAuthDiagnostics(env);
  if (diagnostics.configured) {
    if (diagnostics.activeSource === "environment") {
      const shadowed = diagnostics.storedLoginShadowed ? " Stored login exists but is not used." : "";
      return `Product Hunt token: active source is ${PRODUCTHUNT_TOKEN_ENV} (environment).${shadowed}`;
    }
    return "Product Hunt token: active source is stored login (/producthunt:login).";
  }

  if (diagnostics.failure) {
    return `Product Hunt token missing or unusable: ${diagnostics.failure.message}`;
  }

  return `Product Hunt token missing. Run /producthunt:login or set ${PRODUCTHUNT_TOKEN_ENV}.`;
}

function resolveTokenForValidation(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const envValue = env[PRODUCTHUNT_TOKEN_ENV]?.trim();
  if (envValue) return envValue;
  const stored = inspectStoredAccessToken();
  return stored.loadable ? stored.accessToken : undefined;
}

function buildStoredOrMissingFailure(stored: ReturnType<typeof inspectStoredAccessToken>): AuthFailureDiagnostic {
  if (!stored.fileExists || stored.issue === "missing") {
    return {
      code: "missing_token",
      message: `No Product Hunt token is configured via ${PRODUCTHUNT_TOKEN_ENV} or stored login.`,
      recovery: missingTokenRecovery(),
    };
  }

  if (stored.issue === "unreadable") {
    return {
      code: "auth_file_unreadable",
      message: stored.issueDetail ?? "Stored login file could not be read.",
      recovery: [
        `Check permissions for ${stored.filePath}.`,
        "If the file is corrupted, run /producthunt:logout and /producthunt:login again.",
        `Or set ${PRODUCTHUNT_TOKEN_ENV} in your shell environment.`,
      ],
    };
  }

  return {
    code: "stored_token_invalid",
    message: stored.issueDetail ?? "Stored login file does not contain a usable access token.",
    recovery: [
      "Run /producthunt:logout to remove the invalid stored token, then /producthunt:login.",
      `Or set ${PRODUCTHUNT_TOKEN_ENV} in your shell environment.`,
    ],
  };
}

function classifyValidationError(error: unknown, token: string): AuthFailureDiagnostic {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = redactProductHuntToken(rawMessage, token);
  const status = error instanceof ProductHuntApiError ? error.status : undefined;

  if (status === 401 || status === 403 || /unauthorized|invalid token|authentication/i.test(message)) {
    return {
      code: "invalid_token",
      message: "Product Hunt rejected the access token.",
      recovery: [
        "Create a new developer token in the Product Hunt API dashboard.",
        "Run /producthunt:login to replace the stored token, or update PRODUCTHUNT_ACCESS_TOKEN.",
        "Run /producthunt:status again to confirm access.",
      ],
    };
  }

  return {
    code: "validation_failed",
    message: message || "Product Hunt auth validation failed.",
    recovery: [
      "Check network connectivity to api.producthunt.com.",
      "Run /producthunt:status again after confirming your token.",
      "If the problem persists, regenerate your Product Hunt API token.",
    ],
  };
}

function missingTokenRecovery(): string[] {
  return [
    "Run /producthunt:login to store a token in ~/.pi/agent/pi-producthunt-auth.json.",
    `Or export ${PRODUCTHUNT_TOKEN_ENV} in your shell before starting Pi.`,
    "Run /producthunt:status to verify access without exposing the token.",
  ];
}
