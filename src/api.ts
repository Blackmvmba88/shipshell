import { buildClientWorkspaceContext } from "./semantic-context";

export interface Health {
  ok: boolean;
  system: string;
  model: string;
  aiConfigured: boolean;
  workspace: string;
}

export interface LogEntry {
  id: string;
  createdAt: string;
  event: "mission" | "terminal" | "system";
  status: "planned" | "completed" | "blocked" | "failed";
  summary: string;
}

export interface MissionVisualContext {
  available: boolean;
  imageDataUrl: string;
  error?: string;
}

export interface MissionVisualAnchor {
  id: string;
  kind: "underline" | "circle" | "glow";
  text: string;
  tag: string;
  role: string;
  ariaLabel: string;
  href: string;
  rect: { x: number; y: number; width: number; height: number };
  createdAt: string;
}

export interface MissionContext {
  available: boolean;
  title: string;
  url: string;
  selection: string;
  text: string;
  error?: string;
  anchors?: MissionVisualAnchor[];
  visual?: MissionVisualContext;
}

export type ShipModuleId = "browser" | "ports" | "copilot" | "terminal" | "logbook";

export interface MissionProfile {
  universeId: string;
  workMode: "focus" | "research" | "build" | "studio" | "command" | "casual";
  voice: "quiet" | "technical" | "creative" | "explorer" | "executive" | "conversational";
  activeModule?: ShipModuleId;
}

export interface TerminalSemanticContext {
  cwd: string;
  running: boolean;
  outputShared: boolean;
  lastCommand?: string;
  outputTail?: string;
}

export interface WorkspaceContext {
  activeModule: ShipModuleId;
  activeDeck: "browser" | "marketing" | "logbook";
  universeId: string;
  currentUrl: string;
  terminal?: TerminalSemanticContext;
  logbook?: Array<Pick<LogEntry, "event" | "status" | "summary">>;
}

export interface TerminalDecision {
  allowed: boolean;
  requiresSeal: boolean;
  risk: "read" | "session" | "write" | "external" | "blocked";
  executable?: string;
  args?: string[];
  builtin?: "cd" | "clear";
  reason: string;
}

export interface TerminalApproval {
  id: string;
  fingerprint: string;
  expiresAt: string;
}

export interface TerminalPreview {
  decision: TerminalDecision;
  cwd: string;
  approval?: TerminalApproval;
}

export type TerminalStreamEvent =
  | { type: "start"; cwd: string; decision: TerminalDecision }
  | { type: "stdout" | "stderr"; data: string }
  | { type: "cwd"; cwd: string }
  | { type: "clear" }
  | { type: "error"; message: string }
  | { type: "exit"; exitCode: number | null; cwd: string };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "La maniobra falló");
  return data as T;
}

async function runCommandStream(
  sessionId: string,
  command: string,
  sealId: string | undefined,
  onEvent: (event: TerminalStreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/terminal/run-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, command, sealId }),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "La maniobra falló" }));
    throw new Error(data.error ?? "La maniobra falló");
  }
  if (!response.body) throw new Error("El navegador no expuso el stream de terminal.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as TerminalStreamEvent);
    }
  }

  if (buffer.trim()) onEvent(JSON.parse(buffer) as TerminalStreamEvent);
}

export const api = {
  health: () => request<Health>("/api/health"),
  logbook: () => request<{ entries: LogEntry[] }>("/api/logbook"),
  mission: (
    input: string,
    context?: MissionContext,
    profile?: MissionProfile,
    workspace?: Omit<WorkspaceContext, "logbook">,
  ) => request<{
    decision: { kind: string; normalizedInput: string };
    answer?: string;
    responseId?: string;
    entry?: LogEntry;
  }>("/api/missions", {
    method: "POST",
    body: JSON.stringify({ input, context, profile, workspace: workspace ?? buildClientWorkspaceContext() }),
  }),
  terminalState: (sessionId: string) => request<{ cwd: string }>(`/api/terminal/state?sessionId=${encodeURIComponent(sessionId)}`),
  previewCommand: (sessionId: string, command: string) => request<TerminalPreview>("/api/terminal/preview", {
    method: "POST",
    body: JSON.stringify({ sessionId, command }),
  }),
  approveCommand: (sessionId: string, approval: TerminalApproval) => request<{ ok: boolean }>("/api/terminal/approve", {
    method: "POST",
    body: JSON.stringify({ sessionId, id: approval.id, fingerprint: approval.fingerprint }),
  }),
  runCommandStream,
};
