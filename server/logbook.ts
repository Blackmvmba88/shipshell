import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LogEntry } from "./types.js";

export class Logbook {
  constructor(private readonly filePath: string) {}

  async list(limit = 50): Promise<LogEntry[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const entries = JSON.parse(raw) as LogEntry[];
      return entries.slice(-limit).reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async append(entry: Omit<LogEntry, "id" | "createdAt">): Promise<LogEntry> {
    const current = (await this.list(500)).reverse();
    const complete: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    current.push(complete);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    return complete;
  }
}
