import assert from "node:assert/strict";
import test from "node:test";
import { behaviorAssertions, createSmokeEnvironment, VERIFICATION_CONTRACT } from "../scripts/pi-sdk-smoke-contract.mjs";

const inventory = {
  type: "response",
  id: "commands",
  command: "get_commands",
  success: true,
  data: { commands: [{ name: "producthunt:status", source: "extension" }] },
};

function statusFeatureResponse() {
  return {
    type: "message_end",
    message: {
      role: "custom",
      customType: "producthunt",
      content: "# Product Hunt Authentication\n- Active source: none\n- Status: failed (missing_token)",
    },
  };
}

function promptResponse() {
  return {
    type: "response",
    id: "feature",
    command: "prompt",
    success: true,
    data: { disposition: "handled" },
  };
}

function loginInputFixtures() {
  const request = {
    type: "extension_ui_request",
    id: "input-request",
    method: "input",
    title: "Product Hunt access token:",
  };
  return {
    request,
    response: { id: request.id, type: "extension_ui_response", value: "" },
    notify: { type: "extension_ui_request", method: "notify", message: "Product Hunt token was not saved." },
    prompt: {
      type: "response",
      id: "login",
      command: "prompt",
      success: true,
      data: { disposition: "handled" },
    },
  };
}

function digestSelectFixtures() {
  const request = {
    type: "extension_ui_request",
    id: "select-request",
    method: "select",
    title: "Product Hunt digest date",
    options: ["today", "yesterday", "custom"],
  };
  return {
    request,
    response: { id: request.id, type: "extension_ui_response", value: "today" },
  };
}

test("Pi SDK smoke uses the shared behavioral-v2 contract", () => {
  assert.equal(VERIFICATION_CONTRACT, "pi-sdk-behavior-v2");
});

test("Pi smoke isolates both agent directories and never inherits a Product Hunt token", () => {
  const env = createSmokeEnvironment({
    PI_CODING_AGENT_DIR: "global-pi-dir",
    PI_PRODUCTHUNT_AGENT_DIR: "global-producthunt-dir",
    PRODUCTHUNT_ACCESS_TOKEN: "must-not-be-inherited",
  }, "isolated-agent-dir");
  assert.equal(env.PI_CODING_AGENT_DIR, "isolated-agent-dir");
  assert.equal(env.PI_PRODUCTHUNT_AGENT_DIR, "isolated-agent-dir");
  assert.equal(env.PI_OFFLINE, "1");
  assert.equal(Object.hasOwn(env, "PRODUCTHUNT_ACCESS_TOKEN"), false);
});

test("reload assertions require a second host's registration, handled response, and clean exit", () => {
  const complete = behaviorAssertions({
    name: "reload_cleanup",
    records: [inventory, promptResponse(), statusFeatureResponse()],
    fullOutput: "",
    exitCode: 0,
  });
  assert.deepEqual(complete.map((item) => item.id), [
    "reloaded_extension_registered",
    "reloaded_feature_response",
    "clean_shutdown",
  ]);
  assert.ok(complete.every((item) => item.passed));

  const noFeatureResponse = behaviorAssertions({
    name: "reload_cleanup",
    records: [inventory, promptResponse()],
    fullOutput: "",
    exitCode: 0,
  });
  assert.equal(noFeatureResponse.find((item) => item.id === "reloaded_feature_response").passed, false);

  const noRegistration = behaviorAssertions({
    name: "reload_cleanup",
    records: [promptResponse(), statusFeatureResponse()],
    fullOutput: "",
    exitCode: 0,
  });
  assert.equal(noRegistration.find((item) => item.id === "reloaded_extension_registered").passed, false);

  const uncleanExit = behaviorAssertions({
    name: "reload_cleanup",
    records: [inventory, promptResponse(), statusFeatureResponse()],
    fullOutput: "shutdown error: forced timeout",
    exitCode: null,
    timedOut: true,
  });
  assert.equal(uncleanExit.find((item) => item.id === "clean_shutdown").passed, false);
});

test("happy path requires actual handled Pi response fields and expected feature content", () => {
  const input = loginInputFixtures();
  const result = behaviorAssertions({
    name: "happy_path",
    records: [promptResponse(), statusFeatureResponse(), input.request, input.notify, input.prompt],
    clientActions: [input.response],
    authFileExists: false,
    fullOutput: "",
    exitCode: 0,
  });
  assert.equal(result[0].id, "feature_response");
  assert.equal(result[0].passed, true);
  assert.equal(result[1].id, "interactive_input_safely_cancelled");
  assert.equal(result[1].passed, true);

  const missingPromptDisposition = behaviorAssertions({
    name: "happy_path",
    records: [statusFeatureResponse()],
    fullOutput: "",
    exitCode: 0,
  });
  assert.equal(missingPromptDisposition[0].passed, false);
  assert.equal(missingPromptDisposition[1].passed, false);
});

test("error path requires a handled error and observed UI notification", () => {
  const selector = digestSelectFixtures();
  const result = behaviorAssertions({
    name: "error_path",
    records: [
      promptResponse(),
      selector.request,
      {
        type: "extension_ui_request",
        method: "notify",
        message: "Product Hunt error: PRODUCTHUNT_ACCESS_TOKEN is required.",
      },
      {
        type: "message_end",
        message: {
          role: "custom",
          customType: "producthunt",
          content: "Product Hunt error: PRODUCTHUNT_ACCESS_TOKEN is required.",
        },
      },
    ],
    clientActions: [selector.response],
    fullOutput: "",
    exitCode: 0,
  });
  assert.equal(result[0].id, "handled_error");
  assert.equal(result[0].passed, true);
  assert.equal(result[1].id, "interactive_select");
  assert.equal(result[1].passed, true);

  const missingNotification = behaviorAssertions({
    name: "error_path",
    records: [promptResponse(), {
      type: "message_end",
      message: {
        role: "custom",
        customType: "producthunt",
        content: "Product Hunt error: PRODUCTHUNT_ACCESS_TOKEN is required.",
      },
    }],
    fullOutput: "",
    exitCode: 0,
  });
  assert.equal(missingNotification[0].passed, false);
  assert.equal(missingNotification[1].passed, false);
});
