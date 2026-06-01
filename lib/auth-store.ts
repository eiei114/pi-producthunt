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

export function loadStoredAccessToken(): string | undefined {
  const file = getAuthFilePath();
  try {
    if (!existsSync(file)) return undefined;
    const parsed = JSON.parse(readFileSync(file, "utf-8")) as Partial<ProductHuntAuthRecord>;
    if (parsed.type !== "access_token" || typeof parsed.accessToken !== "string") return undefined;
    const trimmed = parsed.accessToken.trim();
    return trimmed ? trimmed : undefined;
  } catch {
    return undefined;
  }
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

