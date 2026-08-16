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
const EXTERNAL_GIT = new Set(["fetch", "pull", "push", "clone"]);
const LOCAL_GIT_WRITES = new Set([
  "add",
  "restore",
  "reset",
  "checkout",
  "switch",
  "commit",
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "clean",
]);
const BLOCKED_EXECUTABLES = new Set([
  "sudo", "su", "doas", "ssh", "scp", "sftp",
  "bash", "zsh", "sh", "fish",
  "chmod", "chown", "kill", "pkill", "killall",
  "dd", "diskutil", "mount", "umount", "launchctl",
]);
const SEALED_LOCAL_TOOLS = new Set(["mkdir", "touch", "cp", "mv", "rm", "node", "python", "python3", "npx"]);
const SAFE_READ_TOOLS = new Set(["cat", "head", "tail", "grep", "rg"]);
const BLOCKED_READ_OPTIONS = new Set([
  "-f",
  "--file",
  "--exclude-from",
  "--ignore-file",
  "--pre",
  "--pre-glob",
  "--hostname-bin",
]);

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

function optionName(arg: string): string {
  const equals = arg.indexOf("=");
  return equals >= 0 ? arg.slice(0, equals) : arg;
}

function hasBlockedReadOption(args: string[]): boolean {
  return args.some((arg) => arg.startsWith("-") && BLOCKED_READ_OPTIONS.has(optionName(arg)));
}

function gitArgEscapesWorkspace(arg: string): boolean {
  const equals = arg.startsWith("-") ? arg.indexOf("=") : -1;
  const candidate = equals >= 0 ? arg.slice(equals + 1) : arg;
  if (!candidate || candidate === "." || candidate.startsWith("-")) return false;
  if (/^(?:https?|ssh|git):\/\//i.test(candidate) || /^[^/\s@]+@[^:\s]+:.+/.test(candidate)) return false;
  return path.isAbsolute(candidate) || candidate.startsWith("~") || candidate.split(/[\\/]/).includes("..");
}

function gitArgsStayInsideWorkspace(args: string[]): boolean {
  return !args.some(gitArgEscapesWorkspace);
}

function reviewGit(args: string[]): CommandDecision {
  const subcommand = args[0] ?? "";
  const rest = args.slice(1);
  const read = (reason: string): CommandDecision => ({ allowed: true, requiresSeal: false, risk: "read", executable: "git", args, reason });
  const write = (reason: string): CommandDecision => ({ allowed: true, requiresSeal: true, risk: "write", executable: "git", args, reason });
  const external = (reason: string): CommandDecision => ({ allowed: true, requiresSeal: true, risk: "external", executable: "git", args, reason });
  const blocked = (reason: string): CommandDecision => ({ allowed: false, requiresSeal: true, risk: "blocked", reason });

  if (!subcommand || subcommand === "credential") {
    return blocked("Ese comando Git no está expuesto por el puente vivo.");
  }

  if (subcommand.startsWith("-")) {
    return blocked("Las opciones globales de Git están bloqueadas porque pueden alterar configuración o ejecución antes del subcomando.");
  }

  if (!gitArgsStayInsideWorkspace(args)) {
    return blocked("La maniobra Git referencia una ruta absoluta, el home o una ruta que sale del workspace.");
  }

  if (EXTERNAL_GIT.has(subcommand)) {
    return external("Git con efecto remoto o de red: requiere ShipSeal de un solo uso.");
  }

  if (["status", "diff", "log", "show", "rev-parse"].includes(subcommand)) {
    return read("Consulta Git de sólo lectura permitida.");
  }

  if (subcommand === "branch") {
    const safeFlags = new Set(["--list", "-l", "-a", "--all", "-r", "--remotes", "-v", "-vv", "--show-current", "--contains", "--no-contains", "--merged", "--no-merged"]);
    if (rest.length === 0 || rest.every((arg) => arg.startsWith("-") && safeFlags.has(arg))) return read("Listado de ramas permitido.");
    return write("Cambiar o crear ramas requiere ShipSeal. La operación puede activar comportamiento configurado por el repositorio.");
  }

  if (subcommand === "remote") {
    if (rest.length === 0 || (rest.length === 1 && rest[0] === "-v")) return read("Listado de remotos permitido.");
    return write("Modificar remotos Git requiere ShipSeal.");
  }

  if (subcommand === "config") {
    if (["--get", "--get-all", "--list", "-l"].includes(rest[0] ?? "")) return read("Lectura de configuración Git permitida.");
    return blocked("Modificar configuración Git desde el terminal está bloqueado para impedir aliases, hooks o transportes que amplíen la capacidad del puente.");
  }

  if (subcommand === "tag") {
    if (rest.length === 0 || ["--list", "-l"].includes(rest[0] ?? "")) return read("Listado de tags permitido.");
    return write("Crear, mover o borrar tags requiere ShipSeal.");
  }

  if (subcommand === "stash") {
    if (["list", "show"].includes(rest[0] ?? "")) return read("Consulta de stash permitida.");
    return write("Modificar stash requiere ShipSeal. La operación puede activar comportamiento configurado por el repositorio.");
  }

  if (LOCAL_GIT_WRITES.has(subcommand)) {
    return write("Mutación Git local: requiere ShipSeal. Revisa el repositorio porque hooks o filtros configurados pueden participar en algunas operaciones Git.");
  }

  return blocked("Subcomando Git aún no registrado en el puente vivo. Se bloquea por defecto en lugar de delegar capacidades desconocidas a Git.");
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

  if (SAFE_READ_TOOLS.has(executable)) {
    if (hasBlockedReadOption(args)) {
      return {
        allowed: false,
        requiresSeal: true,
        risk: "blocked",
        reason: `${executable} recibió una opción que puede cargar archivos auxiliares o ejecutar un preprocesador fuera del puente estrecho.`,
      };
    }
    if (allPathLikeArgsStayLocal(args.filter((arg) => !arg.startsWith("-")))) {
      return { allowed: true, requiresSeal: false, risk: "read", executable, args, reason: "Lectura de archivos del workspace permitida." };
    }
  }

  if (executable === "git") return reviewGit(args);

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
