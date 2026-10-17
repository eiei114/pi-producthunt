## Pi SDK 1.2.0 compatibility

This package is verified against the frozen Pi SDK versions:

- `@earendil-works/pi-agent-core`: `1.2.0`
- `@earendil-works/pi-ai`: `1.2.0`
- `@earendil-works/pi-coding-agent`: `1.2.0`
- `@earendil-works/pi-tui`: `1.2.0`

These are exact development/test pins. Public peer dependency ranges remain
`*`, preserving the package's existing install compatibility policy.

The extension uses `ExtensionAPI.registerTool`, `registerCommand`,
`sendMessage`, `ExtensionCommandContext.ui.input/select/notify`, and TypeBox
schemas. The verified `pi-extension-template` baseline (PR
[eiei114/pi-extension-template#131](https://github.com/eiei114/pi-extension-template/pull/131),
merged at `4b0554151161eae665aa2cdc845a2d7df40e4781`) documents Pi 1.2.0's
`before_agent_start` event change: handlers must discriminate
`messageType === "user"` before reading user-only `prompt` or `images` fields.
This extension does not register that event, so no API migration is needed.
The other startup/theme changes noted by the baseline do not affect this
package's APIs.

Run `npm run smoke:pi` to exercise the pinned CLI and the actual extension in
an isolated Pi RPC process. `npm run ci` runs this harness. The committed
`docs/verification/pi-sdk-smoke.json` records the `pi-sdk-behavior-v2` result.
The checks verify extension command registration, the `/producthunt:status`
response with no token, the `/producthunt:login` input dialog's empty/cancel
path without creating an auth file, and the `/producthunt:digest` date selector
followed by a handled missing-token error. A second Pi process repeats
registration and feature handling before clean shutdown. The host-shell case
launches the installed CLI through PowerShell on Windows or `/bin/sh` on POSIX.

No Product Hunt token or paid model inference is used: the status path reports
the missing-token state locally and the error path is deliberately handled
before any API request. Pi's installed SDK, CLI process, RPC transport,
extension loading, command handlers, and lifecycle are real; provider inference
is outside this compatibility check. Each RPC probe has a bounded deadline and
uses a temporary agent directory, leaving global Pi settings untouched.
