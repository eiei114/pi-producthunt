import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function withStore(fn) {
  const previous = process.env.PI_PRODUCTHUNT_AGENT_DIR;
  const tmpHome = await mkdtemp(join(tmpdir(), "pi-producthunt-auth-"));
  process.env.PI_PRODUCTHUNT_AGENT_DIR = tmpHome;
  try {
    const authStore = await import(`../lib/auth-store.ts?agent=${encodeURIComponent(tmpHome)}&t=${Date.now()}`);
    await fn(authStore);
  } finally {
    if (previous === undefined) delete process.env.PI_PRODUCTHUNT_AGENT_DIR;
    else process.env.PI_PRODUCTHUNT_AGENT_DIR = previous;
  }
}

test("saveStoredAccessToken and loadStoredAccessToken round-trip trimmed token", async () => {
  await withStore(async ({ getAuthFilePath, loadStoredAccessToken, saveStoredAccessToken }) => {
    saveStoredAccessToken(" token ");
    assert.equal(loadStoredAccessToken(), "token");
    const raw = await readFile(getAuthFilePath(), "utf-8");
    assert.match(raw, /access_token/);
    assert.match(raw, /updatedAt/);
  });
});

test("clearStoredAccessToken removes stored token", async () => {
  await withStore(async ({ clearStoredAccessToken, loadStoredAccessToken, saveStoredAccessToken }) => {
    saveStoredAccessToken("token");
    clearStoredAccessToken();
    assert.equal(loadStoredAccessToken(), undefined);
  });
});


test("inspectStoredAccessToken reports invalid JSON as unreadable", async () => {
  await withStore(async ({ getAuthFilePath, inspectStoredAccessToken }) => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(getAuthFilePath(), "{bad", "utf-8");
    const inspection = inspectStoredAccessToken();
    assert.equal(inspection.loadable, false);
    assert.equal(inspection.issue, "unreadable");
  });
});
