import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
let failures = 0;
let warnings = 0;

function ok(message) { console.log(`✓ ${message}`); }
function fail(message) { failures += 1; console.error(`✗ ${message}`); }
function warn(message) { warnings += 1; console.warn(`! ${message}`); }
function read(relative) { return readFileSync(path.join(root, relative), "utf8"); }

console.log("ShipShell Doctor\n");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 22) ok(`Node ${process.versions.node}`);
else fail(`Node ${process.versions.node}; ShipShell requires Node 22+`);

for (const file of ["package.json", "index.html", "electron/main.mjs", "electron/preload.cjs", "server/index.ts", "src/App.tsx", ".github/workflows/ci.yml"]) {
  if (existsSync(path.join(root, file))) ok(`${file} present`);
  else fail(`${file} missing`);
}

const pkg = JSON.parse(read("package.json"));
if (pkg.private === true) ok("package is private");
else fail("package.json must remain private");
if (pkg.type === "module") ok("ES module mode enabled");
else fail("package.json type must be module");
if (pkg.main === "electron/main.mjs") ok("Electron entrypoint configured");
else fail("unexpected Electron entrypoint");

const html = read("index.html");
if (html.includes("default-src 'self'") && html.includes("object-src 'none'") && html.includes("frame-src 'none'")) ok("deck CSP baseline present");
else fail("deck CSP baseline is incomplete");

const styles = read("src/styles.css");
if (!/https?:\/\//i.test(styles)) ok("base stylesheet has no remote asset dependency");
else warn("base stylesheet references a remote asset; prefer local/system assets under the current CSP");

const gitignore = read(".gitignore");
if (gitignore.includes(".env") && gitignore.includes(".shipshell/")) ok("secrets and runtime state are ignored");
else fail(".gitignore is missing secret/runtime exclusions");

const preload = read("electron/preload.cjs");
if (preload.includes("contextBridge.exposeInMainWorld") && !preload.includes("OPENAI_API_KEY")) ok("preload bridge is narrow and secret-free");
else fail("preload bridge boundary needs review");

const main = read("electron/main.mjs");
for (const boundary of ["nodeIntegration: false", "contextIsolation: true", "sandbox: true", "webSecurity: true"]) {
  if (main.includes(boundary)) ok(`browser boundary: ${boundary}`);
  else fail(`missing browser boundary: ${boundary}`);
}

if (process.env.SHIPSHELL_PORT && !/^\d{2,5}$/.test(process.env.SHIPSHELL_PORT)) fail("SHIPSHELL_PORT must be numeric");
else ok("SHIPSHELL_PORT looks valid");

if (process.env.OPENAI_API_KEY) ok("OPENAI_API_KEY configured for this shell");
else warn("OPENAI_API_KEY not set; AI missions will run in local/no-AI mode");

console.log(`\nDoctor result: ${failures} failure(s), ${warnings} warning(s).`);
process.exitCode = failures ? 1 : 0;
