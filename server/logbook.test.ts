import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Logbook } from "./logbook";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Logbook", () => {
  it("persists evidence and returns newest entries first", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "shipshell-logbook-"));
    cleanup.push(directory);
    const logbook = new Logbook(path.join(directory, "logbook.json"));

    await logbook.append({ event: "mission", status: "completed", summary: "Primera" });
    await logbook.append({ event: "terminal", status: "blocked", summary: "Segunda" });

    const entries = await logbook.list();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ summary: "Segunda", status: "blocked" });
    expect(entries[1].id).toBeTruthy();
  });

  it("redacts secrets from summaries and nested evidence before persistence", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "shipshell-logbook-"));
    cleanup.push(directory);
    const file = path.join(directory, "logbook.json");
    const logbook = new Logbook(file);

    const entry = await logbook.append({
      event: "terminal",
      status: "completed",
      summary: "git remote add origin https://ghp_abcdefghijklmnopqrstuvwxyz123456@example.test/repo",
      evidence: { header: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456" },
    });

    expect(entry.summary).not.toContain("ghp_");
    expect(JSON.stringify(entry.evidence)).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    const persisted = await readFile(file, "utf8");
    expect(persisted).not.toContain("ghp_");
    expect(persisted).not.toContain("Bearer abcdefghijklmnopqrstuvwxyz123456");
  });

  it("sanitizes recognized secrets already present in older Logbook files", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "shipshell-logbook-"));
    cleanup.push(directory);
    const file = path.join(directory, "logbook.json");
    await writeFile(file, JSON.stringify([{
      id: "old-entry",
      createdAt: "2026-08-16T00:00:00.000Z",
      event: "mission",
      status: "completed",
      summary: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456",
    }]), "utf8");

    const logbook = new Logbook(file);
    const [entry] = await logbook.list();
    expect(entry.summary).toBe("OPENAI_API_KEY=[REDACTED]");
    expect(await readFile(file, "utf8")).not.toContain("sk-proj-");
  });
});
