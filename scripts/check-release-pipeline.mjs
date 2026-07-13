#!/usr/bin/env node
/**
 * Read-only release pipeline investigation checks.
 *
 * - Verifies npm registry state for the current package version (no publish)
 * - Validates auto-release workflow token/env formatting
 * - Ensures publish/auto-release workflow files are present
 * - Runs npm pack --dry-run as a non-publish release artifact check
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const autoReleasePath = path.join(root, ".github/workflows/auto-release.yml");
const publishPath = path.join(root, ".github/workflows/publish.yml");
const packageJsonPath = path.join(root, "package.json");

function run(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`release:investigate fail - ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`release:investigate ok - ${message}`);
}

if (!existsSync(packageJsonPath)) {
  fail("package.json is missing");
}
if (!existsSync(autoReleasePath)) {
  fail(".github/workflows/auto-release.yml is missing");
}
if (!existsSync(publishPath)) {
  fail(".github/workflows/publish.yml is missing");
}

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const { name, version } = pkg;
if (!name || !version) {
  fail("package.json must define name and version");
}

ok(`local package is ${name}@${version}`);

let npmVersion = "";
try {
  npmVersion = run(`npm view "${name}@${version}" version`);
} catch (error) {
  const output = String(error.stdout ?? "") + String(error.stderr ?? "");
  if (/E404|404 Not Found/.test(output)) {
    ok(`npm registry has no published ${name}@${version} (unpublished version)`);
  } else {
    fail(`npm view failed: ${output || error.message}`);
  }
}

if (npmVersion) {
  if (npmVersion === version) {
    ok(`npm registry already has ${name}@${version}`);
  } else {
    fail(`npm registry returned unexpected version ${npmVersion} for ${name}@${version}`);
  }
}

const autoRelease = readFileSync(autoReleasePath, "utf8");
if (/\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}\\n/.test(autoRelease)) {
  fail(
    "auto-release.yml contains a corrupted GH_TOKEN value (`${{ secrets.GITHUB_TOKEN }}\\n`); this breaks `gh workflow run` with HTTP 401",
  );
}
ok("auto-release.yml GH_TOKEN formatting looks valid");

if (!/gh workflow run publish\.yml/.test(autoRelease)) {
  fail("auto-release.yml no longer dispatches publish.yml; update investigation expectations");
}
ok("auto-release.yml still dispatches publish.yml");

if (!/id-token:\s*write/.test(readFileSync(publishPath, "utf8"))) {
  fail("publish.yml is missing id-token: write for Trusted Publishing");
}
ok("publish.yml retains Trusted Publishing permission");

run("npm pack --dry-run");
ok("npm pack --dry-run succeeded (non-publish artifact check)");

console.log("release:investigate ok - all checks passed");
