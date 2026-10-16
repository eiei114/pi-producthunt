import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const autoRelease = readFileSync(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publish = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");

function triggerNames(workflow) {
  const lines = workflow.split(/\r?\n/);
  const onIndex = lines.findIndex((line) => line === "on:");
  assert.notEqual(onIndex, -1, "workflow must declare events");

  const names = [];
  for (const line of lines.slice(onIndex + 1)) {
    if (line.trim() === "") continue;
    if (!/^\s/.test(line) && /^[A-Za-z0-9_-]+:/.test(line)) break;
    const match = line.match(/^  ([A-Za-z0-9_-]+):/);
    if (match) names.push(match[1]);
  }
  return names;
}

test("release and publish require separate explicit dispatches", () => {
  assert.deepEqual(triggerNames(autoRelease), ["workflow_dispatch"]);
  assert.deepEqual(triggerNames(publish), ["workflow_dispatch"]);
  assert.doesNotMatch(autoRelease, /gh workflow run publish\.yml/);
});

test("workflow event scanning continues across blank lines", () => {
  const workflow = `on:
  workflow_dispatch:

  push:
    branches: [main]
permissions:
  contents: read
`;

  assert.deepEqual(triggerNames(workflow), ["workflow_dispatch", "push"]);
});

test("release creation is restricted to main", () => {
  assert.match(autoRelease, /github\.ref != 'refs\/heads\/main'/);
});

test("npm publish requires a release tag matching the checked-out package version", () => {
  assert.match(publish, /^        required: true$/m);
  assert.match(publish, /^          ref: refs\/tags\/\$\{\{ github\.event\.inputs\.ref \}\}$/m);
  assert.match(publish, /"\$RELEASE_REF" != "v\$\{PACKAGE_VERSION\}"/);
  assert.match(publish, /TAG_REF="refs\/tags\/\$\{RELEASE_REF\}"/);
  assert.match(publish, /git ls-remote --exit-code --refs origin "\$TAG_REF"/);
});
