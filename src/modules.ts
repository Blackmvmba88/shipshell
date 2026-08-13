export type ShipModuleId = "browser" | "ports" | "copilot" | "terminal" | "logbook";
export type ModuleCapability =
  | "navigate"
  | "connect"
  | "reason"
  | "execute"
  | "observe"
  | "persist"
  | "verify";

export type ModuleSignal =
  | "page.context"
  | "service.port"
  | "mission.request"
  | "mission.answer"
  | "terminal.command"
  | "terminal.output"
  | "log.event";

export interface ShipModuleContract {
  id: ShipModuleId;
  label: string;
  version: 1;
  shortcut: string;
  description: string;
  capabilities: readonly ModuleCapability[];
  accepts: readonly ModuleSignal[];
  provides: readonly ModuleSignal[];
}

export const SHIP_MODULES: readonly ShipModuleContract[] = [
  {
    id: "browser",
    label: "Browser",
    version: 1,
    shortcut: "1",
    description: "Página y navegación activa",
    capabilities: ["navigate", "observe"],
    accepts: ["mission.request"],
    provides: ["page.context", "log.event"],
  },
  {
    id: "ports",
    label: "Ports",
    version: 1,
    shortcut: "2",
    description: "Accesos y herramientas conectadas",
    capabilities: ["connect", "observe"],
    accepts: ["mission.request"],
    provides: ["service.port", "log.event"],
  },
  {
    id: "copilot",
    label: "Copilot",
    version: 1,
    shortcut: "3",
    description: "Contexto, análisis y conversación",
    capabilities: ["reason", "observe"],
    accepts: ["page.context", "service.port", "mission.request", "terminal.output", "log.event"],
    provides: ["mission.answer", "log.event"],
  },
  {
    id: "terminal",
    label: "Terminal",
    version: 1,
    shortcut: "4",
    description: "Ejecución y flujo de desarrollo",
    capabilities: ["execute", "observe", "verify"],
    accepts: ["terminal.command", "mission.request"],
    provides: ["terminal.output", "log.event"],
  },
  {
    id: "logbook",
    label: "Logbook",
    version: 1,
    shortcut: "5",
    description: "Evidencia y actividad verificable",
    capabilities: ["persist", "observe", "verify"],
    accepts: ["log.event"],
    provides: ["log.event"],
  },
] as const;

export function moduleByShortcut(key: string): ShipModuleId | null {
  return SHIP_MODULES.find((module) => module.shortcut === key)?.id ?? null;
}

export function getModuleContract(id: ShipModuleId): ShipModuleContract {
  const contract = SHIP_MODULES.find((module) => module.id === id);
  if (!contract) throw new Error(`Unknown ShipShell module: ${id}`);
  return contract;
}

export function canConnectModules(from: ShipModuleId, to: ShipModuleId): boolean {
  const source = getModuleContract(from);
  const target = getModuleContract(to);
  return source.provides.some((signal) => target.accepts.includes(signal));
}
