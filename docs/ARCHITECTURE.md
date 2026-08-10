# ShipShell architecture

ShipShell is a compact TypeScript implementation of concepts proven in three BlackMamba research projects. It deliberately ports the smallest useful cores instead of copying their entire repositories.

```text
Electron BrowserWindow + React Command Deck
  ├─ Radar
  ├─ Ports / Chromium WebContentsView tabs
  ├─ Crew report
  ├─ Marketing deck
  ├─ Logbook
  └─ Safe terminal
          │
          ▼
Local Express API
  ├─ mission decision router     (Xarvis concept)
  ├─ persistent evidence log     (Xarvis concept)
  ├─ command review policy       (Kodex concept)
  ├─ no-shell command executor   (Kodex concept)
  └─ OpenAI Responses API
```

## Why TypeScript ports

XarvisCore includes many unrelated domains and large binary assets. Kodex is a Python engineering agent with a broader repository-writing contract. ShipShell needs their decision, persistence, and approval ideas in the request path of a desktop/web interface. Reimplementing those small contracts in TypeScript keeps the runtime single-process, testable, and portable while the source repositories remain independent.

## Mission routing

Radar classifies input deterministically before any model call:

- URL → navigate
- freshness/search intent → Responses API with web search
- ordinary prompt → Responses API without web search

This reduces unnecessary tool calls and makes cost behavior testable.

## Trust boundary

The browser UI never receives `OPENAI_API_KEY`. The local server invokes OpenAI and returns only the response text and non-secret evidence identifiers. Terminal subprocesses receive an environment with the API key removed.

## Native browser boundary

Third-party pages render in Electron `WebContentsView` instances, not iframes. Each tab has Node integration disabled, context isolation enabled, sandboxing enabled, and normal web security preserved. Tabs share a persistent ShipShell browser session for logins. Popup requests become tabs instead of uncontrolled windows.

The React command deck controls navigation through a narrow preload bridge. Remote pages do not receive that bridge and cannot invoke terminal or agent APIs.
