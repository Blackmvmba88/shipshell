export type ShipModuleId = "browser" | "ports" | "copilot" | "terminal" | "logbook";

export interface ShipModule {
  id: ShipModuleId;
  label: string;
  shortcut: string;
  description: string;
}

export const SHIP_MODULES: ShipModule[] = [
  { id: "browser", label: "Browser", shortcut: "1", description: "Página y navegación activa" },
  { id: "ports", label: "Ports", shortcut: "2", description: "Accesos y herramientas conectadas" },
  { id: "copilot", label: "Copilot", shortcut: "3", description: "Contexto, análisis y conversación" },
  { id: "terminal", label: "Terminal", shortcut: "4", description: "Ejecución y flujo de desarrollo" },
  { id: "logbook", label: "Logbook", shortcut: "5", description: "Evidencia y actividad verificable" },
];

export function moduleByShortcut(key: string): ShipModuleId | null {
  return SHIP_MODULES.find((module) => module.shortcut === key)?.id ?? null;
}
