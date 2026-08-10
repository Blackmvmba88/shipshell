import { mkdtemp, rm } from "node:fs/promises";
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
});
