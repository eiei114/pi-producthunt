import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const AUTH_FILE_NAME = "pi-producthunt-auth.json";

export interface ProductHuntAuthRecord {
  type: "access_token";
  accessToken: string;
  updatedAt: string;
}

export function getAgentDir(): string {
  const override = process.env.PI_PRODUCTHUNT_AGENT_DIR?.trim();
  if (override) return override;
  return join(homedir(), ".pi", "agent");
}

export function getAuthFilePath(): string {
  return join(getAgentDir(), AUTH_FILE_NAME);
}

function ensureAgentDir(): void {
  try {
    mkdirSync(getAgentDir(), { recursive: true });
  } catch {
    // ignore
  }
}


export type StoredTokenIssue = "missing" | "unreadable" | "invalid_format" | "empty_token";

export interface StoredTokenInspection {
  filePath: string;
  fileExists: boolean;
  loadable: boolean;
  accessToken?: string;
  issue?: StoredTokenIssue;
  issueDetail?: string;
}

export function inspectStoredAccessToken(): StoredTokenInspection {
  const filePath = getAuthFilePath();
  if (!existsSync(filePath)) {
    return { filePath, fileExists: false, loadable: false, issue: "missing" };
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        filePath,
        fileExists: true,
        loadable: false,
        issue: "unreadable",
        issueDetail: "Auth file contains invalid JSON.",
      };
    }

    if (typeof parsed !== "object" || parsed === null) {
      return {
        filePath,
        fileExists: true,
        loadable: false,
        issue: "invalid_format",
        issueDetail: "Auth file does not contain a valid access token record.",
      };
    }

    const record = parsed as Partial<ProductHuntAuthRecord>;
    if (record.type !== "access_token" || typeof record.accessToken !== "string") {
      return {
        filePath,
        fileExists: true,
        loadable: false,
        issue: "invalid_format",
        issueDetail: "Auth file does not contain a valid access token record.",
      };
    }

    const trimmed = record.accessToken.trim();
    if (!trimmed) {
      return {
        filePath,
        fileExists: true,
        loadable: false,
        issue: "empty_token",
        issueDetail: "Stored access token is empty.",
      };
    }

    return { filePath, fileExists: true, loadable: true, accessToken: trimmed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read auth file.";
    return { filePath, fileExists: true, loadable: false, issue: "unreadable", issueDetail: message };
  }
}


export function loadStoredAccessToken(): string | undefined {
  const inspection = inspectStoredAccessToken();
  return inspection.loadable ? inspection.accessToken : undefined;
}

export function saveStoredAccessToken(accessToken: string): void {
  ensureAgentDir();
  const file = getAuthFilePath();
  const record: ProductHuntAuthRecord = {
    type: "access_token",
    accessToken: accessToken.trim(),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(file, JSON.stringify(record, null, 2), "utf-8");
  try {
    chmodSync(file, 0o600);
  } catch {
    // ignore chmod errors on platforms without POSIX modes
  }
}

export function clearStoredAccessToken(): void {
  const file = getAuthFilePath();
  try {
    if (existsSync(file)) rmSync(file);
  } catch {
    // ignore
  }
}

