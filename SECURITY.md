# Security policy

## Security posture

ShipShell is a local-first Electron desktop application. It is **not** designed as an untrusted multi-user remote execution service.

The central security rule is simple:

> Context may inform a proposal. Context does not grant authority.

Remote page content, screenshots, visual-anchor metadata, user notes, terminal output, and model responses are all treated as data. Consequential capabilities remain behind explicit product policy and, where required, a ShipSeal approval.

## Current boundaries

### Local API

- The Express API binds to loopback (`127.0.0.1`) by default.
- Secrets are loaded server-side and are not returned to the React client.
- `.env.local`, `.shipshell/`, runtime evidence, and other local secret/state paths remain ignored by Git.

### Remote browser pages

Third-party sites render in Electron `WebContentsView` tabs with:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`

Remote tabs do not receive the trusted command-deck preload bridge. Remote navigation is limited to reviewed web destinations and permission requests are denied by default unless a capability is explicitly added later.

### Browser context and vision

Page text, selection, URLs, screenshots, and visual anchors cross into the Copilot path only through bounded context objects.

- user selection is preferred over bulk page text
- text is bounded before model use
- image context is bounded and low-detail
- anchors are semantic references, not action authority
- unresolved anchors remain unresolved rather than silently reattaching to the wrong element
- focusing an anchor only highlights local UI; it does not click or execute the element

All remote content remains untrusted even when the model summarizes or references it.

## Terminal execution

The terminal uses pre-execution classification and direct child-process execution.

### Executor rules

- commands are parsed and reviewed before execution
- blocked commands never reach the executor
- child processes run with `shell: false`
- shell expansion and shell operators are not treated as ambient capabilities
- terminal cwd is session-scoped and workspace-bounded
- sensitive environment values such as `OPENAI_API_KEY` are removed from child-process environments
- cancellation propagates to the running child process

### Risk classes

Terminal policy distinguishes safe/read/session behavior from consequential write or external actions. The exact decision object is previewed before a sealed maneuver.

## ShipSeal

ShipSeal is implemented for consequential terminal actions.

A ShipSeal approval is:

- explicit — the user approves the previewed maneuver
- session-bound
- bound to the exact command fingerprint and cwd
- expiring
- single-use

Changing the command, cwd, session, or other bound execution details prevents the approval from being silently reused.

The UI must not start the sealed execution before the approval endpoint succeeds.

## Model boundary

Copilot profiles and Universes may change response emphasis, density, theme, or voice. They must not weaken:

- security checks
- permission requirements
- ShipSeal requirements
- factual standards
- treatment of external content as untrusted data

Model output is never itself an execution token.

## Evidence

A conversational statement that an action completed is not sufficient evidence. ShipShell separates model output from operational outcomes and records mission/terminal evidence in the Logbook.

## Validation

Security-sensitive invariants are covered by multiple layers:

- `npm run doctor` checks architecture and boundary assumptions
- Vitest covers command policy, ShipSeal semantics, browser context, mission content, workspace context, modules, and runtime planning
- TypeScript/Vite validates the production client build
- `npm audit --audit-level=high` gates high-severity dependency findings
- Playwright verifies behavioral boundaries, including that a write command does not run until the explicit ShipSeal approval flow completes

CI runs these gates on pull requests.

## Secrets

Never commit API keys, tokens, cookies, private credentials, or generated runtime state.

If a secret is accidentally committed, treat it as compromised: revoke/rotate it and remove the exposed material from active history where appropriate.

## Reporting a vulnerability

Do not open a public issue containing secrets, exploit details, session material, or reproduction data that could endanger users. Contact the repository owner privately through GitHub before coordinated public disclosure.

## Not currently promised

The current security model does not claim to provide:

- hostile multi-user server isolation
- secure password-manager functionality
- unattended purchases or payments
- unattended destructive account changes
- unrestricted arbitrary shell execution
- automatic bypass of third-party site permissions or authentication

New capabilities should be added through narrow reviewed interfaces rather than by broadening ambient privileges.
