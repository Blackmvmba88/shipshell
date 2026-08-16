# ShipShell architecture

ShipShell is an Electron + TypeScript desktop workspace built around a strict separation between **context**, **proposal**, **authority**, and **execution**.

The system is intentionally modular: browsing, Copilot reasoning, terminal execution, spatial references, presentation modes, privacy boundaries, and evidence can evolve independently as long as their trust contracts remain stable.

## System map

```text
┌──────────────────────────── Electron desktop shell ────────────────────────────┐
│                                                                                │
│  React workspace                                                              │
│  ├── Browser / Ports                                                          │
│  ├── ShipShell Copilot                                                        │
│  ├── Live Terminal + explicit Contexto IA toggle                              │
│  ├── Logbook                                                                  │
│  ├── Visual Anchor Dock                                                       │
│  ├── Semantic Context Bus                                                     │
│  └── Universe + module runtime                                                │
│                                                                                │
│                 narrow preload bridge                                         │
│                        │                                                       │
│                        ▼                                                       │
│  Native Chromium WebContentsView tabs                                         │
│  ├── nodeIntegration: false                                                   │
│  ├── contextIsolation: true                                                   │
│  ├── sandbox: true                                                            │
│  └── webSecurity: true                                                        │
└────────────────────────────────────────────────────────────────────────────────┘
                         │
                         │ loopback HTTP
                         ▼
┌──────────────────────── Local Express API ─────────────────────────────────────┐
│  deterministic mission routing                                                │
│  OpenAI Responses API                                                         │
│  browser/workspace-context validation                                         │
│  multimodal mission-content builder                                           │
│  terminal policy + hardened stream executor                                   │
│  ShipSeal approvals                                                           │
│  shared sensitive-data redaction                                              │
│  sanitized persistent Logbook                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Trust model

ShipShell distinguishes four things that must never be collapsed into one another:

1. **Context** — page text, selection, screenshot, anchors, explicitly shared terminal text, notes, URL, and workspace state.
2. **Proposal** — an explanation, recommendation, navigation target, or requested maneuver.
3. **Authority** — explicit product policy plus, where required, a user-issued ShipSeal.
4. **Execution** — the narrow browser or terminal capability that actually performs work.

External content can influence context and proposals. It cannot manufacture authority.

## Browser boundary

Third-party pages run in Electron `WebContentsView` instances rather than privileged iframes inside the React deck.

Remote tabs have:

- Node integration disabled
- context isolation enabled
- sandboxing enabled
- normal web security enabled
- no access to the command-deck preload bridge

The trusted React surface controls tabs and bounded context capture through a narrow preload API.

### Page context

When page context is enabled and a Copilot mission requests it, ShipShell can capture a bounded snapshot containing:

- page title and URL
- current user selection
- bounded visible/semantic text
- semantic visual anchors
- optional bounded low-detail image context

Selection and semantic text are preferred. Vision supplements them when visual structure matters. Turning page context off prevents the capture call entirely for Copilot missions.

Every field crossing this boundary is treated as untrusted reference data by the mission pipeline.

## Spatial Copilot

Visual Anchors provide stable numbered references between the user and Copilot.

An anchor can contain:

- local anchor id and kind (`underline`, `circle`, or `glow`)
- semantic text
- tag / role / ARIA information
- link target where applicable
- element/test identifiers when available
- bounds
- a short user note
- explicit resolved/unresolved state

Reload, back, and forward navigation can attempt semantic re-identification. If ShipShell cannot safely reattach an anchor, it remains unresolved rather than silently pointing at the wrong element.

Copilot responses may reference `Ancla N`. The trusted deck can then request a local focus pulse on that anchor. **Focus is presentation only; it does not click or execute the page element.**

## Semantic Context Bus

The client publishes bounded workspace state so modules do not need to scrape one another.

Always-safe operational context can include:

- active module
- active deck
- active Universe
- current URL
- terminal cwd and running state
- recent sanitized Logbook summaries

Terminal command text and stdout/stderr have a stronger privacy boundary:

1. terminal output sharing starts **off**
2. the user explicitly enables `Contexto IA`
3. client-side redaction removes recognized secret shapes
4. the server validates `outputShared`
5. when `outputShared` is false, the server strips command/output fields even if a modified client supplies them
6. only the resulting bounded context may reach the model path

This is why terminal UI output and model-facing terminal context are separate objects rather than the same string.

## Sensitive-data persistence

A shared redaction utility is used at semantic and persistence boundaries.

It recognizes common patterns such as:

- secret/token/API-key assignments
- bearer tokens
- common provider token shapes
- credential-bearing HTTP(S) URLs
- JWT-like tokens
- private-key blocks

The same utility protects:

- model-facing terminal command/output context
- persistent terminal history: recognized-secret commands are not saved across sessions
- Logbook summaries and nested evidence before write
- older Logbook entries when read, so recognized historical values can be rewritten in sanitized form

Redaction is defense in depth and cannot prove that arbitrary text is non-secret. Explicit sharing remains the primary privacy control.

## Copilot profiles and Universes

A Universe combines:

- work mode
- visual theme
- Copilot voice
- density
- atmosphere/shader profile

The canonical default is **Professional Graphite**, which keeps the primary workspace visible and disables decorative atmosphere.

Other Universes can reorganize layout priorities or alter response voice. Server validation preserves the invariant that presentation and voice cannot weaken ShipSeal, permissions, security, or factual requirements.

## Terminal architecture

The terminal is a real streamed execution surface, not a simulated output panel.

### Session and filesystem state

Each terminal session maintains a workspace-bounded cwd and supports history, clear, focus shortcuts, and cancellation.

Path containment is checked at two levels:

- lexical path rules reject absolute/home/parent escapes where relevant
- real filesystem resolution rejects symlinks whose effective target leaves the workspace

For new files, ShipShell validates the nearest existing ancestor. The command is reviewed at preview time and reviewed again just before execution.

### Command policy

A command is reviewed before execution and classified into a risk class such as:

- read
- session
- write
- external
- blocked

Blocked commands never reach the executor. Unknown Git subcommands and Git configuration mutation are blocked rather than delegated implicitly.

### Child-process boundary

Child processes run directly with `shell: false`.

Before spawn, ShipShell removes recognized secret-bearing environment variables and common process-injection channels such as Node/Python loader configuration, dynamic-loader variables, and ambient `GIT_*` overrides.

ShipShell-spawned Git receives additional constraints:

- hooks path redirected to an empty ShipShell-managed directory
- FSMonitor disabled
- external diff/textconv helpers disabled for read views
- config reads scoped locally

This narrows surprising repository-controlled execution. It is not OS containment: explicitly sealed project code still runs with the permissions of the ShipShell process.

### ShipSeal

When policy requires approval, preview returns a specific approval object bound to the session, exact command fingerprint, cwd, and expiration time.

The user must explicitly approve that preview before execution. The resulting seal is:

- explicit
- session-bound
- command/cwd-bound
- expiring
- single-use

Changing the command or execution context invalidates the approval contract rather than silently reusing authority.

## Mission routing

Mission input is classified before expensive model work where possible.

Typical paths include:

- URL/navigation intent → navigation proposal
- freshness/search intent → model path with fresh search capability
- ordinary prompt → normal model response
- page-aware Copilot request → bounded semantic/visual context included

This makes routing behavior testable and keeps capability use intentional.

## Evidence and Logbook

ShipShell records operational evidence separately from conversational confidence.

The Logbook is intended to answer questions such as:

- what mission was requested?
- what action was planned or blocked?
- what terminal outcome occurred?
- which contextual surface was active?

Before persistence, summaries and nested evidence pass through shared sensitive-data redaction. Reading an older Logbook also applies the sanitizer and rewrites recognized historical secrets when needed.

A successful-looking UI state is not, by itself, evidence that an external action completed.

## Module contracts and runtime continuity

Browser, Ports, Copilot, Terminal, and Logbook are represented as versioned work modules with explicit capabilities and context contracts.

The update planner distinguishes:

- **hot swap** — compatible presentation/module changes that can occur without replacing the kernel
- **safe handoff** — runtime/kernel changes that require checkpointing and restoring workspace state

Workspace checkpointing preserves user continuity without changing permission semantics.

## Validation layers

ShipShell currently uses four complementary validation layers:

1. `npm run doctor` — environment, architecture, security-boundary, and invariant checks.
2. Vitest — deterministic unit/contract tests, including path containment, execution hardening, redaction, semantic privacy, persistence, and ShipSeal.
3. TypeScript + Vite production build — type and bundling validation across client, server, and shared security utilities.
4. Playwright — behavioral UI checks, including page-context privacy, anchor behavior, professional default state, and explicit ShipSeal approval before a write command runs.

CI runs the dependency audit and installs Chromium so the pull-request gate includes the E2E layer.

## Design rule

**Architecture follows authority.**

A feature should not receive a broad capability merely because it is convenient. ShipShell prefers small bridges, explicit context objects, explicit sharing state, pre-execution classification, sanitization at persistence/model boundaries, and narrowly scoped approvals so that a more capable product does not become an ambiently privileged one.
