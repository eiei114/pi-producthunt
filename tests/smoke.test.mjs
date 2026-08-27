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
const releaseDoc = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const templateChecklistDoc = await readFile(
  new URL("../docs/template-checklist.md", import.meta.url),
  "utf8",
);

function compareSemver(a, b) {
  const parse = (version) => version.split(".").map((part) => Number(part));
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

function getUnreleasedSection(markdown) {
  const match = markdown.match(/## Unreleased\n([\s\S]*?)(?=\n## \[)/);
  if (!match) {
    throw new Error("CHANGELOG.md must include a ## Unreleased section");
  }
  return match[1];
}

test("CHANGELOG preamble stays before release sections", () => {
  const preamble = "All notable changes to this project will be documented in this file.";
  const expectedPrefix = [
    "# Changelog",
    "",
    preamble,
    "",
    "This project follows semantic versioning.",
    "",
    "## Unreleased",
  ].join("\n");

  assert.ok(
    changelog.startsWith(expectedPrefix),
    "CHANGELOG should start with the title, preamble, and Unreleased section",
  );
  const firstReleaseIndex = changelog.search(/^## \[\d+\.\d+\.\d+\]/m);
  assert.ok(
    firstReleaseIndex >= 0,
    "CHANGELOG should include at least one release section",
  );
});

test("CHANGELOG unreleased bump targets stay ahead of package.json version", () => {
  const unreleased = getUnreleasedSection(changelog);
  const bumpVersions = [
    ...unreleased.matchAll(/Bump package version to `(\d+\.\d+\.\d+)`/g),
  ].map((match) => match[1]);

  for (const version of bumpVersions) {
    assert.ok(
      compareSemver(version, packageJson.version) > 0,
      `CHANGELOG Unreleased bump target ${version} must be newer than package.json version ${packageJson.version}`,
    );
  }
});

test("CHANGELOG documents shipped patch releases below package.json version", () => {
  const [major, minor, patch] = packageJson.version.split(".").map(Number);

  for (let patchVersion = 0; patchVersion < patch; patchVersion += 1) {
    const version = `${major}.${minor}.${patchVersion}`;
    assert.match(
      changelog,
      new RegExp(`## \\[${version.replace(/\./g, "\\.")}\\]`),
      `CHANGELOG should include a release section for ${version}`,
    );
  }
});

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

test("release docs checklist lines are not corrupted with literal \\n", () => {
  const docsToCheck = [
    { name: "docs/release.md", content: releaseDoc },
    { name: "docs/template-checklist.md", content: templateChecklistDoc },
  ];

  for (const { name, content } of docsToCheck) {
    const corruptedLines = content
      .split("\n")
      .filter((line) => /\\n\s*$/.test(line) && line.includes("- [ ]"));

    assert.deepEqual(
      corruptedLines,
      [],
      `${name} checklist items must not end with literal \\n: ${corruptedLines.join(" | ")}`,
    );
  }
});
