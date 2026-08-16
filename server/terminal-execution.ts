import type { CommandDecision } from "./guard.js";

const SENSITIVE_ENV_NAME = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIAL|COOKIE|AUTHORIZATION)(?:_|$)/i;
const EXECUTION_INJECTION_ENV = /^(?:NODE_OPTIONS|NODE_PATH|PYTHONPATH|PYTHONHOME|RUBYOPT|PERL5OPT|BASH_ENV|ENV|SHELLOPTS|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_.+|GIT_.+)$/i;

export function buildTerminalEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (SENSITIVE_ENV_NAME.test(key)) continue;
    if (EXECUTION_INJECTION_ENV.test(key)) continue;
    env[key] = value;
  }

  // Network-capable Git can still use the user's SSH agent after an explicit
  // ShipSeal, but arbitrary GIT_* process configuration never crosses the bridge.
  if (source.SSH_AUTH_SOCK) env.SSH_AUTH_SOCK = source.SSH_AUTH_SOCK;
  env.GIT_TERMINAL_PROMPT = "0";
  return env;
}

export function buildTerminalExecutionArgs(decision: CommandDecision, safeHooksPath: string): string[] {
  const args = decision.args ?? [];
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

  return [...hardenedPrefix, subcommand, ...diffSafety, ...rest];
}
