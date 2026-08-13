import path from "node:path";

export type CommandRisk = "read" | "session" | "write" | "external" | "blocked";

export interface CommandDecision {
  allowed: boolean;
  requiresSeal: boolean;
  risk: CommandRisk;
  executable?: string;
  args?: string[];
  builtin?: "cd" | "clear";
  reason: string;
}

const FORBIDDEN_OPERATORS = /[;&|`$<>\n\r]/;
const READ_ONLY_GIT = new Set(["status", "diff", "log", "show", "branch", "rev-parse", "remote", "config"]);
const LOCAL_WRITE_GIT = new Set(["add", "commit", "switch", "checkout", "restore", "reset", "merge", "rebase", "tag", "stash"]);
const EXTERNAL_GIT = new Set(["fetch", "pull", "push", "clone"]);
const BLOCKED_EXECUTABLES = new Set([
  "sudo", "su", "doas", "ssh", "scp", "sftp",
  "bash", "zsh", "sh", "fish",
  "chmod", "chown", "kill", "pkill", "killall",
  "dd", "diskutil", "mount", "umount", "launchctl",
]);
const SEALED_LOCAL_TOOLS = new Set(["mkdir", "touch", "cp", "mv", "rm", "node", "python", "python3", "npx"]);
const SAFE_READ_TOOLS = new Set(["cat", "head", "tail", "grep", "rg"]);

function tokenize(command: string): string[] | null {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (const char of command.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (quote || escaped) return null;
  if (current) tokens.push(current);
  return tokens;
}

function isWorkspaceRelative(value: string): boolean {
  if (!value || value === ".") return true;
  if (value.startsWith("-") || value.startsWith("@")) return true;
  if (path.isAbsolute(value) || value.startsWith("~")) return false;
  return !value.split(/[\\/]/).includes("..");
}

function allPathLikeArgsStayLocal(args: string[]): boolean {
  return args.every((arg) => isWorkspaceRelative(arg));
}

export function reviewCommand(command: string): CommandDecision {
  const trimmed = command.trim();
  if (!trimmed) return { allowed: false, requiresSeal: false, risk: "blocked", reason: "La maniobra está vacía." };
  if (FORBIDDEN_OPERATORS.test(trimmed)) {
    return {
      allowed: false,
      requiresSeal: true,
      risk: "blocked",
      reason: "ShipSeal bloqueó operadores de shell, sustituciones o redirecciones. Ejecuta una maniobra a la vez.",
    };
  }

  const tokens = tokenize(trimmed);
  if (!tokens?.length) {
    return { allowed: false, requiresSeal: false, risk: "blocked", reason: "No pude interpretar las comillas o escapes del comando." };
  }

  const [executable, ...args] = tokens;
  if (BLOCKED_EXECUTABLES.has(executable)) {
    return {
      allowed: false,
      requiresSeal: true,
      risk: "blocked",
      reason: `${executable} queda fuera del puente de trabajo porque puede saltarse el aislamiento o afectar al sistema completo.`,
    };
  }

  if (executable === "clear" && args.length === 0) {
    return { allowed: true, requiresSeal: false, risk: "session", builtin: "clear", reason: "Limpieza visual de la sesión." };
  }
  if (executable === "cd" && args.length <= 1) {
    return { allowed: true, requiresSeal: false, risk: "session", builtin: "cd", args, reason: "Cambio de directorio dentro del workspace." };
  }

  if (["pwd", "whoami"].includes(executable) && args.length === 0) {
    return { allowed: true, requiresSeal: false, risk: "read", executable, args, reason: "Lectura local permitida." };
  }

  if (executable === "ls" && allPathLikeArgsStayLocal(args)) {
    return { allowed: true, requiresSeal: false, risk: "read", executable, args, reason: "Listado local permitido." };
  }

  if (SAFE_READ_TOOLS.has(executable) && allPathLikeArgsStayLocal(args.filter((arg) => !arg.startsWith("-")))) {
    return { allowed: true, requiresSeal: false, risk: "read", executable, args, reason: "Lectura de archivos del workspace permitida." };
  }

  if (executable === "git" && args[0] && READ_ONLY_GIT.has(args[0])) {
    return { allowed: true, requiresSeal: false, risk: "read", executable, args, reason: "Consulta Git de sólo lectura permitida." };
  }

  if (executable === "git" && args[0] && LOCAL_WRITE_GIT.has(args[0])) {
    return { allowed: true, requiresSeal: true, risk: "write", executable, args, reason: "Mutación Git local: requiere ShipSeal de un solo uso." };
  }

  if (executable === "git" && args[0] && EXTERNAL_GIT.has(args[0])) {
    return { allowed: true, requiresSeal: true, risk: "external", executable, args, reason: "Git con efecto remoto o de red: requiere ShipSeal de un solo uso." };
  }

  if (["node", "npm", "python", "python3"].includes(executable) && args.length === 1 && ["--version", "-v"].includes(args[0])) {
    return { allowed: true, requiresSeal: false, risk: "read", executable, args, reason: "Consulta de versión permitida." };
  }

  if (executable === "npm") {
    const action = args[0] ?? "";
    const external = new Set(["install", "i", "uninstall", "remove", "update", "publish", "pack"]);
    return {
      allowed: true,
      requiresSeal: true,
      risk: external.has(action) ? "external" : "write",
      executable,
      args,
      reason: external.has(action)
        ? "npm puede modificar dependencias o hablar con la red: requiere ShipSeal."
        : "Script npm local: requiere ShipSeal porque puede ejecutar código del proyecto.",
    };
  }

  if (SEALED_LOCAL_TOOLS.has(executable)) {
    const fileTools = new Set(["mkdir", "touch", "cp", "mv", "rm"]);
    if (fileTools.has(executable) && !allPathLikeArgsStayLocal(args.filter((arg) => !arg.startsWith("-")))) {
      return { allowed: false, requiresSeal: true, risk: "blocked", reason: "La maniobra intenta salir del workspace." };
    }
    return {
      allowed: true,
      requiresSeal: true,
      risk: executable === "npx" ? "external" : "write",
      executable,
      args,
      reason: `${executable} puede modificar el workspace o ejecutar código: requiere ShipSeal.`,
    };
  }

  return {
    allowed: false,
    requiresSeal: true,
    risk: "blocked",
    reason: "Comando aún no registrado en el puente vivo. Añádelo como maniobra explícita en lugar de abrir un shell sin límites.",
  };
}

export function resolveWorkspace(root: string): string {
  return path.resolve(root);
}

export function resolveTerminalDirectory(workspace: string, current: string, target = "."): string | null {
  const next = path.resolve(current, target || ".");
  const relative = path.relative(workspace, next);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return next;
  return null;
}
