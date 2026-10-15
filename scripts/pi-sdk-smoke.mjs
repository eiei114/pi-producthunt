import { spawn, spawnSync } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  behaviorAssertions,
  createSmokeEnvironment,
  EXTENSION_LOAD_ERROR_PATTERN,
  SDK_NAMES,
  UNHANDLED_ERROR_PATTERN,
  VERIFICATION_CONTRACT,
} from "./pi-sdk-smoke-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const reportPath = resolve(root, "docs/verification/pi-sdk-smoke.json");
const timeoutMs = 15_000;
const cleanupGraceMs = 1_000;
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson(resolve(root, "package.json"));
const sdkVersions = Object.fromEntries(SDK_NAMES.map((name) => [
  name,
  readJson(resolve(root, "node_modules", name, "package.json")).version,
]));

for (const name of SDK_NAMES) {
  if (manifest.devDependencies?.[name] !== sdkVersions[name]) {
    throw new Error(`Smoke requires an exact SDK pin for ${name}; installed ${sdkVersions[name]}`);
  }
}

const piPackagePath = resolve(root, "node_modules/@earendil-works/pi-coding-agent/package.json");
const piManifest = readJson(piPackagePath);
const piCli = resolve(dirname(piPackagePath), piManifest.bin.pi);
const agentDir = mkdtempSync(join(tmpdir(), "pi-producthunt-sdk-smoke-"));
const env = createSmokeEnvironment(process.env, agentDir);

const rpcArgs = [
  piCli,
  "--offline",
  "--no-session",
  "--no-extensions",
  "--no-tools",
  "--no-skills",
  "--no-context-files",
  "--no-prompt-templates",
  "--no-mcp",
  "-e",
  ".",
  "--mode",
  "rpc",
];

function pushRecord(state, record) {
  state.records.push(record);
  for (const listener of state.listeners) listener();
}

function createRpcProcess() {
  const child = spawn(process.execPath, rpcArgs, {
    cwd: root,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const state = {
    child,
    stdout: "",
    stderr: "",
    records: [],
    listeners: new Set(),
    pending: "",
    decoder: new StringDecoder("utf8"),
    closed: false,
    exitCode: null,
    signal: null,
    spawnError: null,
  };

  child.stdout.on("data", (chunk) => {
    const decoded = state.decoder.write(chunk);
    state.stdout += decoded;
    state.pending += decoded;
    let newline;
    while ((newline = state.pending.indexOf("\n")) >= 0) {
      const line = state.pending.slice(0, newline).replace(/\r$/, "");
      state.pending = state.pending.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        pushRecord(state, JSON.parse(line));
      } catch {
        // Keep non-JSON stdout in the captured output; protocol assertions reject missing responses.
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    state.stderr += chunk.toString("utf8");
    for (const listener of state.listeners) listener();
  });
  child.on("error", (error) => {
    state.spawnError = error;
    for (const listener of state.listeners) listener();
  });
  child.on("close", (code, signal) => {
    const tail = state.decoder.end();
    state.stdout += tail;
    state.pending += tail;
    if (state.pending.trim()) {
      try {
        pushRecord(state, JSON.parse(state.pending.trim()));
      } catch {
        // Retained in stdout for diagnostics.
      }
    }
    state.closed = true;
    state.exitCode = code;
    state.signal = signal;
    for (const listener of state.listeners) listener();
  });
  return state;
}

function waitFor(state, predicate, deadline, label) {
  const existing = predicate(state.records);
  if (existing) return Promise.resolve(existing);
  if (state.closed) return Promise.reject(new Error(`Pi exited before ${label} (code ${state.exitCode})`));
  if (state.spawnError) return Promise.reject(state.spawnError);
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new Error(`Pi deadline exceeded waiting for ${label}`));

  return new Promise((resolvePromise, rejectPromise) => {
    const finish = (callback, value) => {
      clearTimeout(timer);
      state.listeners.delete(onChange);
      callback(value);
    };
    const onChange = () => {
      const found = predicate(state.records);
      if (found) return finish(resolvePromise, found);
      if (state.spawnError) return finish(rejectPromise, state.spawnError);
      if (state.closed) return finish(rejectPromise, new Error(`Pi exited before ${label} (code ${state.exitCode})`));
    };
    const timer = setTimeout(() => finish(rejectPromise, new Error(`Pi deadline exceeded waiting for ${label}`)), remaining);
    state.listeners.add(onChange);
    onChange();
  });
}

function responseWithId(records, id) {
  return records.find((record) => record?.type === "response" && record.id === id);
}

function waitForClose(state, maxWaitMs) {
  if (state.closed) return Promise.resolve(true);
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      state.listeners.delete(onChange);
      resolvePromise(false);
    }, Math.max(1, maxWaitMs));
    const onChange = () => {
      if (!state.closed) return;
      clearTimeout(timer);
      state.listeners.delete(onChange);
      resolvePromise(true);
    };
    state.listeners.add(onChange);
  });
}

function commandFor(name) {
  if (name === "happy_path" || name === "reload_cleanup") return "/producthunt:status";
  if (name === "error_path") return "/producthunt:digest";
  return undefined;
}

function redactOutput(value) {
  let redacted = value;
  for (const [path, replacement] of [
    [root, "<repo>"],
    [agentDir, "<isolated-agent-dir>"],
    [homedir(), "<home>"],
  ]) {
    redacted = redacted
      .replaceAll(path, replacement)
      .replaceAll(JSON.stringify(path).slice(1, -1), replacement);
  }
  return redacted;
}

function removeTransientFields(value) {
  if (Array.isArray(value)) return value.map(removeTransientFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== "id" && key !== "timestamp")
      .map(([key, entry]) => [key, removeTransientFields(entry)]));
  }
  return value;
}

async function runRpcCase(name) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  const state = createRpcProcess();
  const clientActions = [];
  let failure = "";
  let timedOut = false;

  try {
    state.child.stdin.write(`${JSON.stringify({ id: "commands", type: "get_commands" })}\n`);
    await waitFor(state, (records) => responseWithId(records, "commands"), deadline, "extension command inventory");

    const message = commandFor(name);
    if (message) {
      state.child.stdin.write(`${JSON.stringify({ id: "feature", type: "prompt", message })}\n`);
      if (name === "happy_path") {
        await waitFor(
          state,
          (records) => records.find((record) => record?.type === "message_end"
            && record.message?.role === "custom" && record.message.customType === "producthunt"),
          deadline,
          "Product Hunt status response",
        );
      }
      if (name === "error_path") {
        const selectRequest = await waitFor(
          state,
          (records) => records.find((record) => record?.type === "extension_ui_request"
            && record.method === "select" && record.title === "Product Hunt digest date"),
          deadline,
          "Product Hunt digest date selector",
        );
        const response = { type: "extension_ui_response", id: selectRequest.id, value: "today" };
        clientActions.push(response);
        state.child.stdin.write(`${JSON.stringify(response)}\n`);
      }
      await waitFor(state, (records) => responseWithId(records, "feature"), deadline, "extension prompt response");
      await waitFor(
        state,
        (records) => records.some((record) => record?.type === "message_end"
          && record.message?.role === "custom" && record.message.customType === "producthunt"),
        deadline,
        "Product Hunt custom feature response",
      );
      if (name === "happy_path") {
        state.child.stdin.write(`${JSON.stringify({ id: "login", type: "prompt", message: "/producthunt:login" })}\n`);
        const inputRequest = await waitFor(
          state,
          (records) => records.find((record) => record?.type === "extension_ui_request"
            && record.method === "input" && record.title === "Product Hunt access token:"),
          deadline,
          "Product Hunt login input dialog",
        );
        const inputResponse = { type: "extension_ui_response", id: inputRequest.id, value: "" };
        clientActions.push(inputResponse);
        state.child.stdin.write(`${JSON.stringify(inputResponse)}\n`);
        await waitFor(state, (records) => responseWithId(records, "login"), deadline, "login cancellation response");
        await waitFor(
          state,
          (records) => records.some((record) => record?.type === "extension_ui_request"
            && record.method === "notify" && record.message === "Product Hunt token was not saved."),
          deadline,
          "safe login cancellation notification",
        );
      }
      if (name === "error_path") {
        await waitFor(
          state,
          (records) => records.some((record) => record?.type === "extension_ui_request"
            && record.method === "notify" && String(record.message).startsWith("Product Hunt error:")),
          deadline,
          "handled Product Hunt error notification",
        );
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    timedOut = /deadline exceeded/i.test(failure);
  } finally {
    if (!state.closed && !state.child.stdin.destroyed) state.child.stdin.end();
    const closed = await waitForClose(state, Math.max(1, deadline - Date.now()));
    if (!closed) {
      timedOut = true;
      state.child.kill();
      await waitForClose(state, cleanupGraceMs);
    }
  }

  const fullOutput = `${state.stdout}${state.stderr}`;
  const actualExitCode = state.closed ? state.exitCode : null;
  const effectiveExitCode = actualExitCode ?? (timedOut ? 124 : 1);
  const assertions = behaviorAssertions({
    name,
    records: state.records,
    clientActions,
    fullOutput,
    exitCode: actualExitCode,
    expectedVersion: sdkVersions["@earendil-works/pi-coding-agent"],
    authFileExists: existsSync(resolve(agentDir, "pi-producthunt-auth.json")),
    timedOut,
  });
  const hasUnhandledError = UNHANDLED_ERROR_PATTERN.test(fullOutput);
  const hasLoadError = EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput);
  const passed = !failure && !state.spawnError && actualExitCode === 0 && !timedOut
    && !hasUnhandledError && !hasLoadError && assertions.every((item) => item.passed);
  const evidence = {
    stdout: redactOutput(JSON.stringify(removeTransientFields(state.records))).slice(-6_000),
    stderr: redactOutput(state.stderr).slice(-6_000),
    process_exit: actualExitCode,
    client_actions: clientActions.map(({ type, value }) => ({ type, value })),
    signal: state.signal,
    timeout_ms: timeoutMs,
    cleanup_grace_ms: timedOut ? cleanupGraceMs : 0,
    failure: failure || undefined,
    spawn_error: state.spawnError?.message,
  };
  return {
    name,
    command: "npm run smoke:pi",
    exit_code: effectiveExitCode,
    passed,
    evidence: JSON.stringify(evidence),
    assertions,
    hasUnhandledError,
    hasLoadError: hasLoadError || (name === "extension_load" && !assertions[0]?.passed),
  };
}

function runHostShellCase() {
  let executable;
  let args;
  if (process.platform === "win32") {
    executable = resolve(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    args = ["-NoProfile", "-NonInteractive", "-Command",
      `& ${quote(process.execPath)} ${quote(piCli)} --no-extensions --version; exit $LASTEXITCODE`];
  } else {
    executable = "/bin/sh";
    args = ["-c", '"$1" "$2" --no-extensions --version', "pi-host-shell", process.execPath, piCli];
  }

  const result = spawnSync(executable, args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const fullOutput = `${stdout}${stderr}`;
  const actualExitCode = result.status;
  const exitCode = actualExitCode ?? (result.error?.code === "ETIMEDOUT" ? 124 : 1);
  const assertions = behaviorAssertions({
    name: "host_shell",
    records: [],
    fullOutput: stdout,
    exitCode: actualExitCode,
    expectedVersion: piManifest.version,
  });
  const hasUnhandledError = UNHANDLED_ERROR_PATTERN.test(fullOutput);
  const hasLoadError = EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput);
  return {
    name: "host_shell",
    command: "npm run smoke:pi",
    exit_code: exitCode,
    passed: actualExitCode === 0 && !result.error && !hasUnhandledError && !hasLoadError
      && assertions.every((item) => item.passed),
    evidence: JSON.stringify({
      stdout: redactOutput(stdout).slice(-6_000),
      stderr: redactOutput(stderr).slice(-6_000),
      process_exit: actualExitCode,
      timeout_ms: timeoutMs,
      error: result.error?.message,
    }),
    assertions,
    hasUnhandledError,
    hasLoadError,
  };
}

try {
  const cases = [];
  for (const name of ["extension_load", "happy_path", "error_path", "reload_cleanup"]) {
    cases.push(await runRpcCase(name));
  }
  cases.push(runHostShellCase());

  const report = {
    schema_version: 1,
    verification_contract: VERIFICATION_CONTRACT,
    sdk_versions: sdkVersions,
    platform: process.platform,
    model_inference: "none; actual extension-handled Pi RPC commands",
    unhandled_errors: cases.filter((item) => item.hasUnhandledError).length,
    extension_load_errors: cases.filter((item) => item.hasLoadError).length,
    cases: cases.map(({ hasUnhandledError, hasLoadError, ...item }) => item),
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    verification_contract: VERIFICATION_CONTRACT,
    platform: process.platform,
    cases: cases.map(({ name, passed, exit_code }) => ({ name, passed, exit_code })),
    unhandled_errors: report.unhandled_errors,
    extension_load_errors: report.extension_load_errors,
  }));
  if (cases.some((item) => !item.passed)) process.exitCode = 1;
} finally {
  rmSync(agentDir, { recursive: true, force: true });
}
