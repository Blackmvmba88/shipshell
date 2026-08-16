import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { redactSensitiveValue } from "../shared/redaction.js";
import type { LogEntry } from "./types.js";

export class Logbook {
  constructor(private readonly filePath: string) {}

  async list(limit = 50): Promise<LogEntry[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const entries = JSON.parse(raw) as LogEntry[];
      const sanitized = redactSensitiveValue(entries);
      if (JSON.stringify(sanitized) !== JSON.stringify(entries)) {
        await writeFile(this.filePath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
      }
      return sanitized.slice(-limit).reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async append(entry: Omit<LogEntry, "id" | "createdAt">): Promise<LogEntry> {
    const current = (await this.list(500)).reverse();
    const complete = redactSensitiveValue<LogEntry>({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    current.push(complete);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    return complete;
  }
}
