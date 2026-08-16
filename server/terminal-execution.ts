import path from "node:path";
import type { CommandDecision } from "./guard.js";

const SENSITIVE_ENV_NAME = /(TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|COOKIE|AUTHORIZATION)/i;
const EXECUTION_INJECTION_ENV = /^(?:NODE_OPTIONS|NODE_PATH|PYTHONPATH|PYTHONHOME|RUBYOPT|PERL5OPT|BASH_ENV|ENV|SHELLOPTS|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_.+|GIT_.+|RIPGREP_CONFIG_PATH)$/i;

function isInsideWorkspace(workspace: string, candidate: string) {
  const relative = path.relative(workspace, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function buildExecutablePath(rawPath: string | undefined, workspace = process.cwd()): string | undefined {
  if (!rawPath) return undefined;
  const safeEntries = rawPath
    .split(path.delimiter)
    .filter(Boolean)
    .filter((entry) => path.isAbsolute(entry))
    .filter((entry) => !isInsideWorkspace(workspace, path.resolve(entry)));
  return safeEntries.length ? [...new Set(safeEntries)].join(path.delimiter) : undefined;
}

export function buildTerminalEnvironment(source: NodeJS.ProcessEnv, workspace = process.cwd()): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (SENSITIVE_ENV_NAME.test(key)) continue;
    if (EXECUTION_INJECTION_ENV.test(key)) continue;
    if (key.toUpperCase() === "PATH") continue;
    env[key] = value;
  }

  const safePath = buildExecutablePath(source.PATH, workspace);
  if (safePath) env.PATH = safePath;

  // Network-capable Git can still use the user's SSH agent after an explicit
  // ShipSeal, but arbitrary GIT_* process configuration never crosses the bridge.
  if (source.SSH_AUTH_SOCK) env.SSH_AUTH_SOCK = source.SSH_AUTH_SOCK;
  env.GIT_TERMINAL_PROMPT = "0";
  env.GIT_ALLOW_PROTOCOL = "https:http:ssh:git";
  env.GIT_PROTOCOL_FROM_USER = "0";
  return env;
}

export function buildTerminalExecutionArgs(decision: CommandDecision, safeHooksPath: string): string[] {
  const args = decision.args ?? [];

  if (decision.executable === "rg") {
    return args.includes("--no-config") ? args : ["--no-config", ...args];
  }

  if (decision.executable !== "git") return args;

  const [subcommand, ...rest] = args;
  if (!subcommand) return args;

  const hardenedPrefix = [
    "-c", `core.hooksPath=${safeHooksPath}`,
    "-c", "core.fsmonitor=false",
  ];

  const diffSafety = ["diff", "log", "show"].includes(subcommand)
    ? ["--no-ext-diff", "--no-textconv"]
    : [];

  // Unsealed Git config reads are intentionally local to the repository. This
  // prevents a harmless-looking query from disclosing global/user config.
  const scopedRest = subcommand === "config" && !rest.includes("--local")
    ? ["--local", ...rest]
    : rest;

  return [...hardenedPrefix, subcommand, ...diffSafety, ...scopedRest];
}
