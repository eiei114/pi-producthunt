import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const autoReleaseWorkflow = await readFile(
  new URL("../.github/workflows/auto-release.yml", import.meta.url),
  "utf8",
);
const examplesDoc = await readFile(new URL("../docs/examples.md", import.meta.url), "utf8");

test("package declares pi resources", () => {
  assert.deepEqual(packageJson.pi.extensions, ["./extensions"]);
});

test("package is discoverable as a Pi package", () => {
  assert.ok(packageJson.keywords.includes("pi-package"));
});

test("package uses public publish config", () => {
  assert.equal(packageJson.publishConfig.access, "public");
});

test("auto-release workflow GH_TOKEN values are not corrupted with literal \\n", () => {
  const ghTokenLines = autoReleaseWorkflow
    .split("\n")
    .filter((line) => line.includes("GH_TOKEN:"));

  assert.ok(ghTokenLines.length > 0, "auto-release.yml should define GH_TOKEN");

  for (const line of ghTokenLines) {
    assert.equal(
      /\\n\s*$/.test(line),
      false,
      `auto-release.yml GH_TOKEN line must not end with literal \\n: ${line}`,
    );
  }

  assert.equal(
    /\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}\\n/.test(autoReleaseWorkflow),
    false,
    "auto-release.yml must not embed a corrupted GH_TOKEN value with trailing \\n",
  );
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

test("docs/examples.md documents pi-producthunt instead of template placeholders", () => {
  const staleMarkers = [
    "template-hello",
    "extensions/hello.ts",
    "template_greet",
    "skills/example-skill",
    "prompts/example.md",
    "themes/example-theme.json",
    "lib/greeting.ts",
  ];

  for (const marker of staleMarkers) {
    assert.equal(
      examplesDoc.includes(marker),
      false,
      `docs/examples.md should not reference stale template marker: ${marker}`,
    );
  }

  assert.match(examplesDoc, /\/producthunt:/);
  assert.match(examplesDoc, /\/producthunt:today/);
  assert.match(examplesDoc, /producthunt_get_posts/);
  assert.match(examplesDoc, /extensions\/index\.ts/);
});
