import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

async function withAgentDir(fn) {
  const previous = {
    PI_PRODUCTHUNT_AGENT_DIR: process.env.PI_PRODUCTHUNT_AGENT_DIR,
    PRODUCTHUNT_ACCESS_TOKEN: process.env.PRODUCTHUNT_ACCESS_TOKEN,
  };
  const tmpHome = await mkdtemp(join(tmpdir(), "pi-producthunt-diagnostics-"));
  process.env.PI_PRODUCTHUNT_AGENT_DIR = tmpHome;
  delete process.env.PRODUCTHUNT_ACCESS_TOKEN;

  try {
    const authDiagnostics = await import(`../lib/auth-diagnostics.ts?dir=${encodeURIComponent(tmpHome)}&t=${Date.now()}`);
    const authStore = await import(`../lib/auth-store.ts?dir=${encodeURIComponent(tmpHome)}&t=${Date.now()}`);
    await fn({ authDiagnostics, authStore, tmpHome });
  } finally {
    if (previous.PI_PRODUCTHUNT_AGENT_DIR === undefined) delete process.env.PI_PRODUCTHUNT_AGENT_DIR;
    else process.env.PI_PRODUCTHUNT_AGENT_DIR = previous.PI_PRODUCTHUNT_AGENT_DIR;
    if (previous.PRODUCTHUNT_ACCESS_TOKEN === undefined) delete process.env.PRODUCTHUNT_ACCESS_TOKEN;
    else process.env.PRODUCTHUNT_ACCESS_TOKEN = previous.PRODUCTHUNT_ACCESS_TOKEN;
  }
}

test("getProductHuntAuthDiagnostics reports environment token source", async () => {
  await withAgentDir(async ({ authDiagnostics }) => {
    process.env.PRODUCTHUNT_ACCESS_TOKEN = "env-token";
    const diagnostics = authDiagnostics.getProductHuntAuthDiagnostics();
    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.activeSource, "environment");
    assert.equal(diagnostics.envTokenPresent, true);
    assert.equal(diagnostics.failure, undefined);
  });
});

test("getProductHuntAuthDiagnostics reports stored token source", async () => {
  await withAgentDir(async ({ authDiagnostics, authStore }) => {
    authStore.saveStoredAccessToken("stored-token");
    const diagnostics = authDiagnostics.getProductHuntAuthDiagnostics();
    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.activeSource, "stored");
    assert.equal(diagnostics.storedLoginUsable, true);
  });
});

test("getProductHuntAuthDiagnostics reports missing token", async () => {
  await withAgentDir(async ({ authDiagnostics }) => {
    const diagnostics = authDiagnostics.getProductHuntAuthDiagnostics();
    assert.equal(diagnostics.configured, false);
    assert.equal(diagnostics.activeSource, "missing");
    assert.equal(diagnostics.failure?.code, "missing_token");
    assert.match(diagnostics.failure?.message ?? "", /No Product Hunt token/);
  });
});

test("getProductHuntAuthDiagnostics reports unreadable auth file", async () => {
  await withAgentDir(async ({ authDiagnostics, authStore, tmpHome }) => {
    await writeFile(authStore.getAuthFilePath(), "{not-json", "utf-8");
    const diagnostics = authDiagnostics.getProductHuntAuthDiagnostics();
    assert.equal(diagnostics.configured, false);
    assert.equal(diagnostics.failure?.code, "auth_file_unreadable");
    assert.match(diagnostics.failure?.message ?? "", /invalid JSON/i);
    assert.equal(diagnostics.authFilePath.includes(tmpHome), true);
  });
});

test("getProductHuntAuthDiagnostics reports invalid stored token format", async () => {
  await withAgentDir(async ({ authDiagnostics, authStore }) => {
    await writeFile(authStore.getAuthFilePath(), JSON.stringify({ type: "wrong", accessToken: "x" }), "utf-8");
    const diagnostics = authDiagnostics.getProductHuntAuthDiagnostics();
    assert.equal(diagnostics.configured, false);
    assert.equal(diagnostics.failure?.code, "stored_token_invalid");
  });
});

test("authStatusText never includes secret values", async () => {
  await withAgentDir(async ({ authDiagnostics }) => {
    process.env.PRODUCTHUNT_ACCESS_TOKEN = "super-secret-token-value";
    const status = authDiagnostics.authStatusText();
    assert.equal(status.includes("super-secret-token-value"), false);
    assert.match(status, /environment/);
  });
});

test("validateProductHuntAccess classifies invalid token without leaking secret", async () => {
  await withAgentDir(async ({ authDiagnostics }) => {
    process.env.PRODUCTHUNT_ACCESS_TOKEN = "invalid-token-12345";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ errors: [{ message: "Unauthorized" }] }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });

    try {
      const validation = await authDiagnostics.validateProductHuntAccess();
      assert.equal(validation.ok, false);
      assert.equal(validation.failure?.code, "invalid_token");
      const serialized = JSON.stringify(validation);
      assert.equal(serialized.includes("invalid-token-12345"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
