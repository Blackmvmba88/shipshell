import { describe, expect, it } from "vitest";
import { reviewCommand } from "./guard";
import { TerminalSealStore } from "./terminal-seal";

describe("TerminalSealStore", () => {
  it("requires explicit approval and consumes a seal once", () => {
    const store = new TerminalSealStore(60_000);
    const command = "git add src/App.tsx";
    const cwd = "/workspace/project";
    const decision = reviewCommand(command);
    const ticket = store.issue(command, cwd, decision);

    expect(store.consume(ticket.id, command, cwd, decision)).toBe(false);
    expect(store.approve(ticket.id, ticket.fingerprint)).toBe(true);
    expect(store.consume(ticket.id, command, cwd, decision)).toBe(true);
    expect(store.consume(ticket.id, command, cwd, decision)).toBe(false);
  });

  it("binds approval to the exact command and cwd fingerprint", () => {
    const store = new TerminalSealStore(60_000);
    const command = "npm run build";
    const cwd = "/workspace/project";
    const decision = reviewCommand(command);
    const ticket = store.issue(command, cwd, decision);
    expect(store.approve(ticket.id, ticket.fingerprint)).toBe(true);
    expect(store.consume(ticket.id, "npm publish", cwd, reviewCommand("npm publish"))).toBe(false);
    expect(store.consume(ticket.id, command, "/workspace/other", decision)).toBe(false);
  });

  it("does not require tickets for read-only commands", () => {
    const store = new TerminalSealStore(60_000);
    const decision = reviewCommand("git status");
    expect(store.consume(undefined, "git status", "/workspace/project", decision)).toBe(true);
  });
});
