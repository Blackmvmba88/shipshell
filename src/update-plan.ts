import type { ShipModuleContract } from "./modules";

export type UpdateApplyMode = "hot" | "safe-handoff" | "reject";

export interface ModuleUpdateCandidate extends ShipModuleContract {
  revision: string;
}

export interface ModuleUpdatePlan {
  mode: UpdateApplyMode;
  reason: string;
  preservesSession: boolean;
}

function sameSignals(current: readonly string[], next: readonly string[]) {
  return current.length === next.length && current.every((signal) => next.includes(signal));
}

export function planModuleUpdate(current: ShipModuleContract, next: ModuleUpdateCandidate): ModuleUpdatePlan {
  if (current.id !== next.id) {
    return { mode: "reject", reason: "El candidato pertenece a otro módulo.", preservesSession: true };
  }

  const contractCompatible =
    current.version === next.version &&
    sameSignals(current.accepts, next.accepts) &&
    sameSignals(current.provides, next.provides);

  if (contractCompatible) {
    return {
      mode: "hot",
      reason: `Contrato ${current.id}@v${current.version} compatible; puede intercambiarse sin desmontar el workspace.`,
      preservesSession: true,
    };
  }

  return {
    mode: "safe-handoff",
    reason: `Cambió el contrato de ${current.id}; conserva estado, aplica la revisión y restaura la sesión en un handoff controlado.`,
    preservesSession: true,
  };
}

export interface WorkspaceCheckpoint {
  version: 1;
  activeModule: string;
  expandedModule: string | null;
  universeId: string;
  activeDeck: string;
  url: string;
  savedAt: string;
}

const CHECKPOINT_KEY = "shipshell.workspace.checkpoint";

export function saveWorkspaceCheckpoint(checkpoint: Omit<WorkspaceCheckpoint, "version" | "savedAt">) {
  const value: WorkspaceCheckpoint = {
    version: 1,
    ...checkpoint,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(value));
  return value;
}

export function readWorkspaceCheckpoint(): WorkspaceCheckpoint | null {
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<WorkspaceCheckpoint>;
    if (value.version !== 1 || typeof value.activeModule !== "string" || typeof value.universeId !== "string") return null;
    return value as WorkspaceCheckpoint;
  } catch {
    return null;
  }
}
