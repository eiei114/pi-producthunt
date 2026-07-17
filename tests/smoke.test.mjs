import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

test("package declares pi resources", () => {
  assert.deepEqual(packageJson.pi.extensions, ["./extensions"]);
});

test("package is discoverable as a Pi package", () => {
  assert.ok(packageJson.keywords.includes("pi-package"));
});

test("package uses public publish config", () => {
  assert.equal(packageJson.publishConfig.access, "public");
});

test("README version pin example matches package.json version", () => {
  const pinnedVersions = [
    ...readme.matchAll(/npm:pi-producthunt@(\d+\.\d+\.\d+)/g),
  ].map((match) => match[1]);

  assert.ok(
    pinnedVersions.length > 0,
    "README should include at least one pinned npm install example",
  );

  for (const version of pinnedVersions) {
    assert.equal(
      version,
      packageJson.version,
      `README pinned version ${version} should match package.json version ${packageJson.version}`,
    );
  }
});
