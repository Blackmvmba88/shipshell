import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
let failures = 0;
let warnings = 0;

function ok(message) { console.log(`✓ ${message}`); }
function info(message) { console.log(`· ${message}`); }
function fail(message) { failures += 1; console.error(`✗ ${message}`); }
function warn(message) { warnings += 1; console.warn(`! ${message}`); }
function read(relative) { return readFileSync(path.join(root, relative), "utf8"); }

console.log("ShipShell Doctor\n");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 22) ok(`Node ${process.versions.node}`); else fail(`Node ${process.versions.node}; ShipShell requires Node 22+`);

for (const file of [
  "package.json",
  "index.html",
  "electron/main.mjs",
  "electron/preload.cjs",
  "electron/visual-anchors.mjs",
  "server/index.ts",
  "server/browser-context.ts",
  "server/browser-context.test.ts",
  "server/copilot-profile.ts",
  "server/mission-content.ts",
  "server/mission-content.test.ts",
  "server/workspace-context.ts",
  "server/workspace-context.test.ts",
  "server/guard.ts",
  "server/guard.test.ts",
  "server/terminal-seal.ts",
  "server/terminal-seal.test.ts",
  "src/App.tsx",
  "src/AnnotationDock.tsx",
  "src/LiveTerminal.tsx",
  "src/api.ts",
  "src/semantic-context.ts",
  "src/modules.ts",
  "src/modules.test.ts",
  "src/update-plan.ts",
  "src/update-plan.test.ts",
  "src/annotations.css",
  "src/copilot.css",
  "src/integration-tokens.css",
  "src/modules.css",
  "src/terminal.css",
  "src/universes.ts",
  "src/universes.css",
  "playwright.config.ts",
  "tests/e2e/smoke.spec.ts",
  "tests/e2e/copilot-shipseal.spec.ts",
  "SECURITY.md",
  ".github/workflows/ci.yml",
]) {
  if (existsSync(path.join(root, file))) ok(`${file} present`); else fail(`${file} missing`);
}

for (const file of ["electron/main.mjs", "electron/preload.cjs", "electron/visual-anchors.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
  if (result.status === 0) ok(`${file} syntax valid`);
  else fail(`${file} syntax invalid: ${(result.stderr || result.stdout || "unknown syntax error").trim().slice(0, 300)}`);
}

const pkg = JSON.parse(read("package.json"));
if (pkg.private === true) ok("package is private"); else fail("package.json must remain private");
if (pkg.type === "module") ok("ES module mode enabled"); else fail("package.json type must be module");
if (pkg.main === "electron/main.mjs") ok("Electron entrypoint configured"); else fail("unexpected Electron entrypoint");
if (pkg.scripts?.["test:e2e"] === "playwright test" && pkg.scripts?.["e2e:server"]?.includes("vite --host 127.0.0.1")) ok("Playwright E2E has a self-managed local server contract"); else fail("Playwright E2E scripts are incomplete");

const html = read("index.html");
if (html.includes("default-src 'self'") && html.includes("object-src 'none'") && html.includes("frame-src 'none'")) ok("deck CSP baseline present");
else fail("deck CSP baseline is incomplete");

const styles = [
  read("src/styles.css"),
  read("src/universes.css"),
  read("src/copilot.css"),
  read("src/terminal.css"),
  read("src/modules.css"),
  read("src/annotations.css"),
  read("src/integration-tokens.css"),
].join("\n");
if (!/https?:\/\//i.test(styles)) ok("stylesheets have no remote asset dependency"); else warn("a stylesheet references a remote asset");
if (styles.includes("--font-mono: var(--mono)") || !styles.includes("var(--font-mono)")) ok("integrated module typography resolves to the professional mono token"); else fail("legacy module font token is unresolved");

const universes = read("src/universes.ts");
for (const mode of ["focus", "research", "build", "studio", "command", "casual"]) {
  if (universes.includes(`workMode: \"${mode}\"`)) ok(`universe mode present: ${mode}`); else fail(`missing universe mode: ${mode}`);
}
if (universes.includes('id: "professional-graphite"') && universes.includes('DEFAULT_UNIVERSE_ID = "professional-graphite"')) ok("Professional Graphite is the canonical default Universe"); else fail("professional default Universe contract missing");
if (universes.includes("window.localStorage.setItem(\"shipshell.universe\"")) ok("universe preference persists locally"); else fail("universe preference persistence missing");

const profile = read("server/copilot-profile.ts");
for (const voice of ["quiet", "technical", "creative", "explorer", "executive", "conversational"]) {
  if (profile.includes(`${voice}:`)) ok(`copilot voice present: ${voice}`); else fail(`missing copilot voice: ${voice}`);
}
if (profile.includes("activeModule") && profile.includes("no concede permisos adicionales")) ok("active module guides attention without granting authority"); else fail("active module context must not grant permissions");
if (profile.includes("nunca cambia las reglas de seguridad") && profile.includes("ShipSeal")) ok("voice profiles preserve ShipSeal boundary"); else fail("voice profiles must explicitly preserve ShipSeal safety boundary");

const modules = read("src/modules.ts");
for (const moduleId of ["browser", "ports", "copilot", "terminal", "logbook"]) {
  if (modules.includes(`id: \"${moduleId}\"`)) ok(`work module present: ${moduleId}`); else fail(`missing work module: ${moduleId}`);
}
if (modules.includes("version: 1") && modules.includes("capabilities:") && modules.includes("accepts:") && modules.includes("provides:") && modules.includes("canConnectModules")) ok("work modules expose versioned composable contracts"); else fail("work modules must expose versioned capability/signal contracts");

const updatePlan = read("src/update-plan.ts");
if (updatePlan.includes('"hot"') && updatePlan.includes('"safe-handoff"') && updatePlan.includes("saveWorkspaceCheckpoint")) ok("runtime updates distinguish hot swap from safe handoff and preserve workspace state"); else fail("runtime update planner is incomplete");

const semanticClient = read("src/semantic-context.ts");
const semanticServer = read("server/workspace-context.ts");
const browserContext = read("server/browser-context.ts");
const missionContent = read("server/mission-content.ts");
const apiClient = read("src/api.ts");
if (semanticClient.includes("publishTerminalContext") && semanticClient.includes("buildClientWorkspaceContext")) ok("client semantic context bus publishes terminal and workspace state"); else fail("client semantic context bus is incomplete");
if (semanticServer.includes("WORKSPACE_CONTEXT_JSON") && semanticServer.includes("never instructions")) ok("server labels semantic context as reference data"); else fail("semantic context trust boundary missing");
if (browserContext.includes("WORKSPACE_CONTEXT_JSON") && browserContext.includes("sin pedir capturas manuales")) ok("copilot prompt prefers semantic context over manual screenshots"); else fail("copilot semantic-context guidance missing");
if (browserContext.includes("visualAnchorSchema") && browserContext.includes("data:image/jpeg;base64") && browserContext.includes("visualAnchors")) ok("browser context validates bounded vision and semantic visual anchors"); else fail("browser visual-context boundary missing");
if (missionContent.includes('type: "input_image"') && missionContent.includes('detail: "low"') && missionContent.includes("imageDataUrl")) ok("copilot mission content supports bounded low-detail automatic vision"); else fail("multimodal mission content wiring missing");
if (apiClient.includes("buildClientWorkspaceContext") && apiClient.includes("workspace: workspace ??") && apiClient.includes("MissionVisualAnchor")) ok("missions attach semantic workspace and visual anchor context automatically"); else fail("missions are not automatically attaching semantic context");

const app = read("src/App.tsx");
if (app.includes("activeModule") && app.includes("expandedModule") && app.includes("moduleByShortcut")) ok("module selection, expansion, and keyboard focus are wired"); else fail("module focus system is incomplete");
if (app.includes('runMission(prompt, true, "copilot")') && app.includes("activeModuleOverride ?? activeModule")) ok("Copilot mission profile does not depend on React event timing"); else fail("Copilot module context must be explicit at mission dispatch");

const annotationDock = read("src/AnnotationDock.tsx");
if (annotationDock.includes('id: "underline"') && annotationDock.includes('id: "circle"') && annotationDock.includes('id: "glow"') && annotationDock.includes("clearAnnotations")) ok("visual anchors dock exposes underline, circle, glow, and clear tools"); else fail("visual anchors dock is incomplete");

const server = read("server/index.ts");
const guard = read("server/guard.ts");
const terminalSeal = read("server/terminal-seal.ts");
const liveTerminal = read("src/LiveTerminal.tsx");
const main = read("electron/main.mjs");
const preload = read("electron/preload.cjs");
const visualAnchors = read("electron/visual-anchors.mjs");
if (server.includes("buildWorkspaceContextBlock") && server.includes("semanticContextUsed") && server.includes("terminalContextUsed")) ok("server feeds and records semantic workspace context"); else fail("server semantic context wiring missing");
if (server.includes("buildMissionContent") && server.includes("visualContextUsed") && server.includes('express.json({ limit: "1mb" })')) ok("server accepts bounded visual context and records vision usage"); else fail("server automatic vision wiring missing");
if (main.includes("capturePage") && main.includes("targetBytes = 350_000") && main.includes("browser:set-annotation-mode") && main.includes("readVisualAnchors")) ok("electron captures bounded page vision and manages semantic visual anchors"); else fail("electron page vision or visual anchors wiring missing");
if (visualAnchors.includes("annotationClient") && visualAnchors.includes("exportAnchors") && visualAnchors.includes("ss-glow")) ok("visual anchor runtime is isolated and serializable"); else fail("visual anchor runtime is incomplete");
if (preload.includes("setAnnotationMode") && preload.includes("clearAnnotations") && preload.includes("getAnnotations")) ok("preload exposes narrow visual-anchor controls"); else fail("visual-anchor preload bridge missing");
if (liveTerminal.includes("publishTerminalContext") && liveTerminal.includes("output.slice(-8000)")) ok("terminal publishes bounded live semantic state"); else fail("terminal semantic publisher missing");
if (server.includes("/api/terminal/run-stream") && server.includes("application/x-ndjson")) ok("live terminal streams process output"); else fail("live terminal streaming route missing");
if (server.includes("terminalSessions = new Map") && server.includes("resolveTerminalDirectory") && server.includes("session.cwd")) ok("terminal cwd is session-aware and workspace-bounded"); else fail("terminal session cwd boundary missing");
if (terminalSeal.includes("sessionId") && terminalSeal.includes("approved: false") && terminalSeal.includes("ticket.used = true") && terminalSeal.includes("ttlMs = 60_000")) ok("terminal ShipSeal is session-bound, explicit, expiring, and single-use"); else fail("terminal ShipSeal must be session-bound, explicit, expiring, and single-use");
if (guard.includes("BLOCKED_EXECUTABLES") && guard.includes("BLOCKED_READ_OPTIONS") && guard.includes("gitArgsStayInsideWorkspace") && guard.includes('subcommand.startsWith("-")') && guard.includes("requiresSeal: true") && guard.includes("reviewGit")) ok("terminal policy blocks shell, tool-option, Git-config, and workspace escape paths"); else fail("terminal risk policy is incomplete");
if (server.includes("shell: false") && server.includes("delete env[key]") && server.includes("OPENAI_API_KEY")) ok("terminal child processes avoid shell expansion and secret inheritance"); else fail("terminal process isolation needs review");
if (server.includes("res.on(\"close\"") && server.includes("SIGINT")) ok("terminal process cancellation propagates to the child process"); else fail("terminal cancellation wiring missing");
if (liveTerminal.includes("HISTORY_KEY") && liveTerminal.includes("ArrowUp") && liveTerminal.includes("Ctrl+L") && /abortRef\.current\?\.abort\(\)/.test(liveTerminal)) ok("terminal developer ergonomics include history, clear, focus, and Ctrl+C cancellation"); else fail("terminal developer ergonomics are incomplete");
if (liveTerminal.includes("Sellar y ejecutar") && liveTerminal.includes("runCommandStream")) ok("terminal UI exposes explicit ShipSeal and live output"); else fail("terminal UI is not wired to live ShipSeal flow");

const guardTests = read("server/guard.test.ts");
if (guardTests.includes("grep --file=/etc/passwd") && guardTests.includes("git -c alias.x=!sh x") && guardTests.includes("git clone https://example.com/repo.git ../outside")) ok("terminal regression tests cover tool-internal and Git escape paths"); else fail("terminal guard regression coverage is incomplete");

const sealTests = read("server/terminal-seal.test.ts");
if (sealTests.includes("not-the-ticket-fingerprint") && sealTests.includes("TerminalSealStore(0)")) ok("ShipSeal tests cover wrong fingerprints and expiry"); else fail("ShipSeal expiry/fingerprint coverage missing");

const playwright = read("playwright.config.ts");
const smokeE2e = read("tests/e2e/smoke.spec.ts");
const shipSealE2e = read("tests/e2e/copilot-shipseal.spec.ts");
if (playwright.includes("webServer") && playwright.includes("e2e:server") && playwright.includes("trace: 'on-first-retry'")) ok("Playwright owns its test server and captures retry evidence"); else fail("Playwright server/evidence configuration incomplete");
if (smokeE2e.includes("professional-graphite") && smokeE2e.includes("ShipSeal protegido")) ok("smoke E2E validates the professional default surface"); else fail("smoke E2E does not assert the product default");
if (shipSealE2e.includes("focusAnnotations") && shipSealE2e.includes("runBody).toBeUndefined") && shipSealE2e.includes("Sellar y ejecutar")) ok("behavioral E2E covers spatial Copilot and pre-execution ShipSeal gating"); else fail("behavioral E2E safety coverage incomplete");

const ci = read(".github/workflows/ci.yml");
if (ci.includes("npm run validate") && ci.includes("playwright install --with-deps chromium") && ci.includes("npm run test:e2e")) ok("CI gates Doctor, unit/build/audit, and Chromium E2E"); else fail("CI validation stack is incomplete");

const security = read("SECURITY.md");
if (security.includes("ShipSeal is implemented") && security.includes("single-use") && security.includes("Context does not grant authority")) ok("security policy describes the implemented authority model"); else fail("SECURITY.md is stale relative to the implemented runtime");

const gitignore = read(".gitignore");
if (gitignore.includes(".env") && gitignore.includes(".shipshell/")) ok("secrets and runtime state are ignored"); else fail(".gitignore is missing secret/runtime exclusions");

if (preload.includes("contextBridge.exposeInMainWorld") && !preload.includes("OPENAI_API_KEY")) ok("preload bridge is narrow and secret-free"); else fail("preload bridge boundary needs review");
for (const boundary of ["nodeIntegration: false", "contextIsolation: true", "sandbox: true", "webSecurity: true"]) {
  if (main.includes(boundary)) ok(`browser boundary: ${boundary}`); else fail(`missing browser boundary: ${boundary}`);
}

if (process.env.SHIPSHELL_PORT && !/^\d{2,5}$/.test(process.env.SHIPSHELL_PORT)) fail("SHIPSHELL_PORT must be numeric"); else ok("SHIPSHELL_PORT looks valid");
if (process.env.OPENAI_API_KEY) ok("OPENAI_API_KEY configured for this shell"); else if (process.env.CI) info("OPENAI_API_KEY intentionally absent in CI"); else warn("OPENAI_API_KEY not set; AI missions will run in local/no-AI mode");

console.log(`\nDoctor result: ${failures} failure(s), ${warnings} warning(s).`);
process.exitCode = failures ? 1 : 0;
