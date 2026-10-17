import { resolve } from "node:path";

export const VERIFICATION_CONTRACT = "pi-sdk-behavior-v2";
export const SDK_NAMES = [
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
];

export const UNHANDLED_ERROR_PATTERN = /UnhandledPromiseRejection|uncaught exception|shutdown error/i;
export const EXTENSION_LOAD_ERROR_PATTERN = /Failed to load extension|Error loading extension/i;

export function registerStdinErrorHandler(stdin) {
  stdin.on("error", () => {
    // Process close state and failed RPC assertions retain the useful diagnostics.
  });
}

export function smokeReportPath(root, agentDir, persistReport) {
  return persistReport
    ? resolve(root, "docs/verification/pi-sdk-smoke.json")
    : resolve(agentDir, "pi-sdk-smoke.json");
}

export function createSmokeEnvironment(baseEnvironment, agentDir) {
  const env = {
    ...baseEnvironment,
    PI_CODING_AGENT_DIR: agentDir,
    PI_PRODUCTHUNT_AGENT_DIR: agentDir,
    PI_OFFLINE: "1",
  };
  delete env.PRODUCTHUNT_ACCESS_TOKEN;
  return env;
}

function assertion(id, expected, observed, passed) {
  return { id, expected, observed: JSON.stringify(observed), passed: passed === true };
}

function response(records, command, id) {
  return records.find((record) => record?.type === "response"
    && record.command === command && (id === undefined || record.id === id));
}

function textFromMessage(message) {
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) return "";
  return message.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

function summarizeFeatureMessages(messages) {
  return messages.map((message) => ({
    customType: message.customType,
    details: message.details,
    text: textFromMessage(message).replace(/[A-Za-z]:\\[^\s)]+/g, "<local-path>"),
  }));
}

function summarizeNotification(notification) {
  if (!notification) return null;
  return {
    method: notification.method,
    message: notification.message,
    notifyType: notification.notifyType,
  };
}

function getExtensionCommands(records) {
  const result = response(records, "get_commands", "commands");
  return result?.success === true && Array.isArray(result.data?.commands)
    ? result.data.commands.filter((command) => command?.source === "extension")
    : [];
}

function getFeatureResponse(records) {
  const messages = records
    .filter((record) => record?.type === "message_end")
    .map((record) => record.message)
    .filter((message) => message?.role === "custom" && message.customType === "producthunt");
  return { messages, text: messages.map(textFromMessage).join("\n") };
}

function handledPrompt(records) {
  const result = response(records, "prompt", "feature");
  return result?.success === true && result.data?.disposition === "handled" ? result : undefined;
}

export function behaviorAssertions({
  name,
  records,
  clientActions = [],
  fullOutput,
  exitCode,
  expectedVersion,
  authFileExists = false,
  timedOut = false,
}) {
  const commands = getExtensionCommands(records);
  const registered = commands.some((command) => command.name === "producthunt:status");
  const prompt = handledPrompt(records);
  const feature = getFeatureResponse(records);
  const notifications = records.filter((record) => record?.type === "extension_ui_request"
    && record.method === "notify" && typeof record.message === "string");

  if (name === "extension_load") {
    const command = commands.find((item) => item.name === "producthunt:status");
    return [assertion(
      "extension_registered",
      "The actual Pi host lists producthunt:status as an extension command",
      { command: command ? { name: command.name, description: command.description, source: command.source } : null },
      registered,
    )];
  }

  if (name === "happy_path") {
    const expectedResponse = feature.text.includes("# Product Hunt Authentication")
      && feature.text.includes("- Active source: none")
      && feature.text.includes("- Status: failed (missing_token)");
    const inputRequest = records.find((record) => record?.type === "extension_ui_request"
      && record.method === "input" && record.title === "Product Hunt access token:");
    const inputResponse = clientActions.find((action) => action.type === "extension_ui_response"
      && action.id === inputRequest?.id && action.value === "");
    const loginPrompt = response(records, "prompt", "login");
    const warning = notifications.find((record) => record.message === "Product Hunt token was not saved.");
    return [
      assertion(
        "feature_response",
        "The handled status command reports the local missing-token diagnostics without API access",
        { prompt: prompt ?? null, messages: summarizeFeatureMessages(feature.messages), containsExpectedStatus: expectedResponse },
        Boolean(prompt && expectedResponse),
      ),
      assertion(
        "interactive_input_safely_cancelled",
        "The actual RPC input dialog accepts an empty value, reports that no token was saved, and creates no auth file",
        {
          inputRequest: inputRequest ? { method: inputRequest.method, title: inputRequest.title } : null,
          inputResponse: inputResponse ? { type: inputResponse.type, value: inputResponse.value } : null,
          loginPrompt: loginPrompt ?? null,
          warning: summarizeNotification(warning),
          authFileExists,
        },
        Boolean(inputRequest && inputResponse && loginPrompt?.success === true
          && loginPrompt.data?.disposition === "handled" && warning && !authFileExists),
      ),
    ];
  }

  if (name === "error_path") {
    const notification = notifications.find((record) => record.message.startsWith("Product Hunt error:"));
    const expectedError = feature.text.includes("Product Hunt error: PRODUCTHUNT_ACCESS_TOKEN is required.");
    const selectRequest = records.find((record) => record?.type === "extension_ui_request"
      && record.method === "select" && record.title === "Product Hunt digest date");
    const selectResponse = clientActions.find((action) => action.type === "extension_ui_response"
      && action.id === selectRequest?.id && action.value === "today");
    return [
      assertion(
        "handled_error",
        "An unauthenticated digest command is handled and reports the missing-token error via Pi UI and extension message",
        {
          prompt: prompt ?? null,
          notification: summarizeNotification(notification),
          messages: summarizeFeatureMessages(feature.messages),
          containsExpectedError: expectedError,
        },
        Boolean(prompt && notification && expectedError),
      ),
      assertion(
        "interactive_select",
        "The actual RPC date selector accepts the today choice before the handled error response",
        {
          selectRequest: selectRequest ? { method: selectRequest.method, title: selectRequest.title, options: selectRequest.options } : null,
          selectResponse: selectResponse ? { type: selectResponse.type, value: selectResponse.value } : null,
        },
        Boolean(selectRequest && selectResponse),
      ),
    ];
  }

  if (name === "reload_cleanup") {
    const command = commands.find((item) => item.name === "producthunt:status");
    const expectedResponse = feature.text.includes("# Product Hunt Authentication")
      && feature.text.includes("- Status: failed (missing_token)");
    return [
      assertion(
        "reloaded_extension_registered",
        "The second actual Pi host lists producthunt:status as an extension command",
        { command: command ? { name: command.name, description: command.description, source: command.source } : null },
        registered,
      ),
      assertion(
        "reloaded_feature_response",
        "The second actual Pi host handles status and returns the expected missing-token response",
        { prompt: prompt ?? null, messages: summarizeFeatureMessages(feature.messages), containsExpectedStatus: expectedResponse },
        Boolean(prompt && expectedResponse),
      ),
      assertion(
        "clean_shutdown",
        "The second Pi process exits normally within the deadline without unhandled or shutdown errors",
        { exit_code: exitCode, timedOut, errors: UNHANDLED_ERROR_PATTERN.test(fullOutput) },
        exitCode === 0 && !timedOut && !UNHANDLED_ERROR_PATTERN.test(fullOutput),
      ),
    ];
  }

  if (name === "host_shell") {
    return [assertion(
      "native_shell_boundary",
      "The native host shell launches the locally pinned Pi CLI and reports its exact version",
      { exit_code: exitCode, output: fullOutput.trim(), expectedVersion },
      exitCode === 0 && fullOutput.trim() === expectedVersion,
    )];
  }

  throw new Error(`Unknown Pi SDK smoke case: ${name}`);
}
