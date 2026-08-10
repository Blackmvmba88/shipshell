export type MissionKind = "navigate" | "search" | "ask";

export interface MissionDecision {
  kind: MissionKind;
  normalizedInput: string;
  requiresNetwork: boolean;
  requiresSeal: boolean;
}

export interface LogEntry {
  id: string;
  createdAt: string;
  event: "mission" | "terminal" | "system";
  status: "planned" | "completed" | "blocked" | "failed";
  summary: string;
  evidence?: Record<string, unknown>;
}
