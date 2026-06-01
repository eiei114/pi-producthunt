import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const { authStatusText, getProductHuntToken, redactProductHuntToken } = await import("../lib/config.ts");

test("getProductHuntToken reads env token", () => {
  assert.equal(getProductHuntToken({ PRODUCTHUNT_ACCESS_TOKEN: " token " }), "token");
});

test("getProductHuntToken fails when missing", async () => {
  const previous = process.env.PI_PRODUCTHUNT_AGENT_DIR;
  const tmpHome = await mkdtemp(join(tmpdir(), "pi-producthunt-missing-"));
  process.env.PI_PRODUCTHUNT_AGENT_DIR = tmpHome;
  try {
    const config = await import(`../lib/config.ts?missing=${encodeURIComponent(tmpHome)}&t=${Date.now()}`);
    assert.throws(() => config.getProductHuntToken({}), /PRODUCTHUNT_ACCESS_TOKEN/);
  } finally {
    if (previous === undefined) delete process.env.PI_PRODUCTHUNT_AGENT_DIR;
    else process.env.PI_PRODUCTHUNT_AGENT_DIR = previous;
  }
});

test("resolveProductHuntAccessToken prefers environment over stored login", async () => {
  const previous = {
    PI_PRODUCTHUNT_AGENT_DIR: process.env.PI_PRODUCTHUNT_AGENT_DIR,
    PRODUCTHUNT_ACCESS_TOKEN: process.env.PRODUCTHUNT_ACCESS_TOKEN,
  };
  const tmpHome = await mkdtemp(join(tmpdir(), "pi-producthunt-config-"));
  process.env.PI_PRODUCTHUNT_AGENT_DIR = tmpHome;
  delete process.env.PRODUCTHUNT_ACCESS_TOKEN;

  try {
    const authStore = await import(`../lib/auth-store.ts?agent=${encodeURIComponent(tmpHome)}&t=${Date.now()}`);
    authStore.saveStoredAccessToken("stored-token");
    process.env.PRODUCTHUNT_ACCESS_TOKEN = "env-token";

    const config = await import(`../lib/config.ts?agent=${encodeURIComponent(tmpHome)}&t=${Date.now()}`);
    const resolved = config.resolveProductHuntAccessToken();

    assert.equal(resolved.accessToken, "env-token");
    assert.equal(resolved.source, "environment");
  } finally {
    if (previous.PI_PRODUCTHUNT_AGENT_DIR === undefined) delete process.env.PI_PRODUCTHUNT_AGENT_DIR;
    else process.env.PI_PRODUCTHUNT_AGENT_DIR = previous.PI_PRODUCTHUNT_AGENT_DIR;
    if (previous.PRODUCTHUNT_ACCESS_TOKEN === undefined) delete process.env.PRODUCTHUNT_ACCESS_TOKEN;
    else process.env.PRODUCTHUNT_ACCESS_TOKEN = previous.PRODUCTHUNT_ACCESS_TOKEN;
  }
});

test("authStatusText hides secrets", () => {
  const previous = process.env.PRODUCTHUNT_ACCESS_TOKEN;
  process.env.PRODUCTHUNT_ACCESS_TOKEN = "secret-token";
  try {
    const status = authStatusText();
    assert.match(status, /environment variable/);
    assert.equal(status.includes("secret-token"), false);
  } finally {
    if (previous === undefined) delete process.env.PRODUCTHUNT_ACCESS_TOKEN;
    else process.env.PRODUCTHUNT_ACCESS_TOKEN = previous;
  }
});

test("redactProductHuntToken removes bearer token and raw token", () => {
  const result = redactProductHuntToken("Authorization: Bearer secret-token and secret-token", "secret-token");
  assert.equal(result.includes("secret-token"), false);
  assert.match(result, /\[REDACTED\]/);
});

