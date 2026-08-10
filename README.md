# BlackMamba ShipShell

**The intelligent command deck for the open web.**

ShipShell is an AI-first desktop workspace that brings browsing, conversation, terminal work, memory, and guarded execution into one operational interface.

> Do not just find the answer. Put it in motion.

## Vision

```text
┌──────────────────────────────────────────────┐
│ Browser                         Crew / Chat  │
├──────────────────────────────────────────────┤
│ Integrated terminal                          │
└──────────────────────────────────────────────┘
```

ShipShell is designed around a simple promise:

- search with context instead of collecting links
- navigate without manually sending screenshots
- keep the human at the helm
- preserve decisions and evidence in the Logbook
- require a ShipSeal before sensitive maneuvers

## Product language

- **Command Deck** — the main workspace
- **Radar** — intelligent search and research
- **Ports** — connected sites and services
- **Missions** — user goals and tasks
- **Crew** — specialized agents
- **Maneuvers** — proposed browser or terminal actions
- **Logbook** — persistent history, context, and evidence
- **ShipSeal** — explicit approval for sensitive actions

## Architecture direction

```text
ShipShell Desktop
├── browser and tabs
├── intelligent Radar
├── persistent chat
├── integrated terminal
├── marketing deck
└── orchestration layer
    ├── Xarvis-inspired decisions and memory
    ├── Kodex-inspired guarded execution
    └── ShipSeal approval gates
```

Related research and source projects remain independent:

- [Kodex](https://github.com/Blackmvmba88/Kodex) — guarded engineering control plane
- [XarvisCore](https://github.com/Blackmvmba88/XarvisCore) — local-first decision runtime and persistent memory
- [Neural Browser prototype](https://github.com/Blackmvmba88/aeroacoustic-resonance-engine) — interface and interaction research

ShipShell will integrate proven concepts without modifying or erasing those repositories.

## Status

ShipShell now has a runnable desktop MVP with:

1. a native Chromium browser surface with real tabs and configurable Ports
2. an OpenAI-powered Navigator using the Responses API
3. a visible terminal restricted to verified read-only maneuvers
4. a unified URL, question, and fresh-web-search Radar
5. a persistent local Logbook
6. ShipSeal permission boundaries for consequential actions

Marketing integrations remain an upcoming milestone. The interface labels missing connections honestly instead of rendering fabricated campaign metrics.

## Quickstart

Requirements: Node.js 20 or newer and an OpenAI API key.

```bash
npm install
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local
npm run dev
```

For the real ShipShell browser, run:

```bash
npm run desktop:dev
```

The regular `npm run dev` web surface is retained for UI development, but external sites are never presented as iframes. Real browsing occurs in isolated Electron `WebContentsView` tabs.

Validate the repository:

```bash
npm run check
```

## Runtime boundaries

- The API binds to `127.0.0.1` by default.
- API keys never reach the browser UI or terminal child processes.
- Terminal commands run without a shell and are checked against a read-only allowlist.
- Absolute paths, parent traversal, shell operators, redirects, and mutations are blocked.
- Missions and terminal outcomes are written to `.shipshell/logbook.json`, which is ignored by Git.

Read [the architecture](docs/ARCHITECTURE.md), [the security policy](SECURITY.md), and [the contribution guide](CONTRIBUTING.md).

## Principles

1. Local-first where practical.
2. Preview before mutation.
3. Evidence before claims.
4. Human approval before consequential actions.
5. Portable data and explicit boundaries.
6. No surprise commits, pushes, publishing, purchases, or deletion.

## License

License selection is pending.
