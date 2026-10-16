#!/usr/bin/env node
/**
 * Read-only release pipeline investigation checks.
 *
 * - Verifies npm registry state for the current package version (no publish)
 * - Verifies release and publish actions require explicit workflow/release events
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
  return execSync(cmd, { cwd: root, encoding: "utf8", timeout: 30000 }).trim();
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
  npmVersion = run(`npm view ${name}@${version} version`);
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
const publish = readFileSync(publishPath, "utf8");
if (/\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}\\n/.test(autoRelease)) {
  fail(
    "auto-release.yml contains a corrupted GH_TOKEN value (`${{ secrets.GITHUB_TOKEN }}\\n`)",
  );
}
ok("auto-release.yml GH_TOKEN formatting looks valid");

if (!/^  workflow_dispatch:\s*$/m.test(autoRelease) || /^  push:\s*$/m.test(autoRelease)) {
  fail("auto-release.yml must be manually dispatched and must not run on pushes");
}
if (!/if: github\.ref == 'refs\/heads\/main'/.test(autoRelease)) {
  fail("auto-release.yml must restrict release creation to main");
}
if (!/gh release create/.test(autoRelease) || /gh workflow run publish\.yml/.test(autoRelease)) {
  fail("auto-release.yml must create a release without dispatching npm publication");
}
ok("release creation is an explicit main-branch workflow dispatch");

if (/^  push:\s*$/m.test(publish)) {
  fail("publish.yml must not run from merge or tag pushes");
}
if (!/^  release:\s*$/m.test(publish) || !/^  workflow_dispatch:\s*$/m.test(publish)) {
  fail("publish.yml must retain release and explicit workflow_dispatch triggers");
}
ok("npm publication is separate from merge pushes");

if (!/id-token:\s*write/.test(publish)) {
  fail("publish.yml is missing id-token: write for Trusted Publishing");
}
ok("publish.yml retains Trusted Publishing permission");

run("npm pack --dry-run");
ok("npm pack --dry-run succeeded (non-publish artifact check)");

console.log("release:investigate ok - all checks passed");
