# BlackMamba ShipShell

**A guarded AI desktop workspace for the open web.**

ShipShell combines a native Chromium browser, a page-aware Copilot, a live terminal, spatial references, persistent evidence, and explicit approval boundaries in one Electron workspace.

The default experience is intentionally calm and professional. More expressive **Universes** remain optional presentation/work-mode layers; they do not change permissions, facts, or ShipSeal policy.

## What ShipShell does today

- **Native browsing** — real Electron `WebContentsView` tabs; remote sites are never embedded as privileged iframes.
- **Persistent Copilot** — can receive a bounded semantic snapshot of the active page when the user enables context.
- **Automatic browser vision** — low-detail, bounded capture is available when semantic context is not enough.
- **Spatial Copilot** — underline, circle, or glow page elements; numbered anchors remain explicit references between user and Copilot.
- **Semantic Context Bus** — publishes the active module, deck, Universe, URL, bounded terminal state, and recent operational context.
- **Live terminal** — streamed stdout/stderr, session-scoped cwd, history, cancellation, and explicit command policy.
- **ShipSeal** — consequential terminal actions require a single-use, expiring approval bound to the exact command and cwd.
- **Logbook** — missions and operational outcomes are retained as evidence instead of being implied from UI state.
- **Composable modules** — Browser, Ports, Copilot, Terminal, and Logbook expose versioned module contracts and workspace handoff/checkpoint planning.
- **Universes** — work modes can change density, layout priority, Copilot voice, theme, and atmosphere without weakening safety boundaries.

## Default product surface

New workspaces start in **Professional Graphite**:

- all primary work modules remain available
- no decorative shader is enabled
- the visual language stays restrained and desktop-like
- security state is communicated explicitly instead of through ambient neon

Optional presets include Focus Minimal, Research Sunset, Build Obsidian, Studio Neon Mamba, Command Deck, and Casual Glass.

## Core interaction loop

```text
Observe page
    ↓
Copilot receives bounded context / anchors
    ↓
Explain or propose
    ↓
If action is consequential → ShipSeal approval
    ↓
Execute through a narrow capability boundary
    ↓
Record outcome / evidence
```

ShipShell treats page text, screenshots, terminal output, anchor notes, and other external content as **untrusted reference data**. Context can inform a proposal; it cannot grant authority.

## Architecture

```text
Electron desktop shell
├── React workspace
│   ├── Browser / Ports
│   ├── ShipShell Copilot
│   ├── Live Terminal
│   ├── Logbook
│   ├── Visual Anchor Dock
│   └── Universe / module runtime
│
├── native Chromium WebContentsView tabs
│   ├── nodeIntegration: false
│   ├── contextIsolation: true
│   ├── sandbox: true
│   └── webSecurity: true
│
└── local Express API (127.0.0.1)
    ├── deterministic mission routing
    ├── OpenAI Responses API
    ├── bounded semantic / visual context validation
    ├── terminal policy + streaming executor
    ├── ShipSeal approval store
    └── evidence Logbook
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the detailed boundaries.

## Quickstart

Requirements: **Node.js 22+**. An OpenAI API key is required only for AI-backed missions.

```bash
npm install
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local when needed
npm run dev
```

For the real desktop browser:

```bash
npm run desktop:dev
```

The normal Vite surface remains useful for UI development and Playwright tests. Full third-party browsing happens in the isolated Electron tabs.

## Validation

Environment and security checks:

```bash
npm run doctor
```

Unit tests + TypeScript + production build:

```bash
npm run check
```

Full non-E2E validation, including dependency audit:

```bash
npm run validate
```

Behavioral browser tests:

```bash
npm run test:e2e
```

Playwright starts its own Vite server. CI installs Chromium and gates pull requests on the full E2E suite, including page-context/anchor behavior and the explicit ShipSeal approval flow.

## Security and trust invariants

1. The browser UI never receives `OPENAI_API_KEY`.
2. Remote pages cannot invoke the preload bridge used by the command deck.
3. Remote content, screenshots, notes, anchors, and terminal output are data — never authority.
4. Terminal child processes run without shell expansion and with secrets removed from their environment.
5. Commands are classified before execution; blocked commands do not reach the executor.
6. Consequential terminal actions require an explicit ShipSeal.
7. A terminal ShipSeal is session-bound, command/cwd-bound, expiring, and single-use.
8. Spatial focus may highlight a page element; highlighting alone never clicks or executes a remote action.
9. A Universe may change presentation and response voice; it cannot weaken security, permissions, or factual requirements.
10. Claims of completed work should be backed by runtime output, tests, or Logbook evidence.

## Product principles

- Calm default, expressive modes by choice.
- Context without hidden authority.
- Preview before mutation.
- Evidence before claims.
- Explicit approval before consequential actions.
- Narrow capability boundaries over broad ambient permissions.
- Workspace continuity without silently changing security contracts.

## Related BlackMamba research

ShipShell reuses proven ideas while keeping the source projects independent:

- [Kodex](https://github.com/Blackmvmba88/Kodex) — guarded engineering control-plane research.
- [XarvisCore](https://github.com/Blackmvmba88/XarvisCore) — local-first decision and memory research.
- [Neural Browser prototype](https://github.com/Blackmvmba88/aeroacoustic-resonance-engine) — browser interaction research.

## License

License selection is pending.
