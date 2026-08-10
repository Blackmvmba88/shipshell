import path from "node:path";

export interface CommandDecision {
  allowed: boolean;
  requiresSeal: boolean;
  executable?: string;
  args?: string[];
  reason: string;
}

const FORBIDDEN = /[;&|`$<>\n\r]/;
const READ_ONLY_GIT = new Set(["status", "diff", "log", "show", "branch", "rev-parse"]);

function tokenize(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

export function reviewCommand(command: string): CommandDecision {
  if (!command.trim()) return { allowed: false, requiresSeal: false, reason: "La maniobra está vacía." };
  if (FORBIDDEN.test(command)) {
    return { allowed: false, requiresSeal: true, reason: "ShipSeal bloqueó operadores de shell o redirecciones." };
  }

  const [executable, ...args] = tokenize(command);
  if (["pwd", "whoami"].includes(executable) && args.length === 0) {
    return { allowed: true, requiresSeal: false, executable, args, reason: "Lectura local permitida." };
  }
  const safeListArg = (arg: string) => {
    if (arg.startsWith("-")) return ["-l", "-la", "-a"].includes(arg);
    return !path.isAbsolute(arg) && !arg.startsWith("~") && !arg.split(/[\\/]/).includes("..");
  };
  if (executable === "ls" && args.every(safeListArg)) {
    return { allowed: true, requiresSeal: false, executable, args, reason: "Listado local permitido." };
  }
  if (executable === "git" && args[0] && READ_ONLY_GIT.has(args[0])) {
    return { allowed: true, requiresSeal: false, executable, args, reason: "Consulta Git de sólo lectura permitida." };
  }
  if (["node", "npm", "python", "python3"].includes(executable) && args.length === 1 && ["--version", "-v"].includes(args[0])) {
    return { allowed: true, requiresSeal: false, executable, args, reason: "Consulta de versión permitida." };
  }

  return {
    allowed: false,
    requiresSeal: true,
    reason: "Esta versión del puente sólo ejecuta maniobras de lectura verificadas.",
  };
}

export function resolveWorkspace(root: string): string {
  return path.resolve(root);
}
