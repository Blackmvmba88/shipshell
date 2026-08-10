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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "La maniobra falló");
  return data as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  logbook: () => request<{ entries: LogEntry[] }>("/api/logbook"),
  mission: (input: string) => request<{ decision: { kind: string; normalizedInput: string }; answer?: string }>("/api/missions", {
    method: "POST",
    body: JSON.stringify({ input }),
  }),
  runCommand: (command: string) => request<{ stdout: string; stderr: string; exitCode: number | null }>("/api/terminal/run", {
    method: "POST",
    body: JSON.stringify({ command }),
  }),
};
