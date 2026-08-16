import { describe, expect, it } from "vitest";
import { reviewCommand } from "./guard";
import { TerminalSealStore } from "./terminal-seal";

describe("TerminalSealStore", () => {
  it("requires explicit approval and consumes a seal once", () => {
    const store = new TerminalSealStore(60_000);
    const sessionId = "00000000-0000-4000-8000-000000000001";
    const command = "git add src/App.tsx";
    const cwd = "/workspace/project";
    const decision = reviewCommand(command);
    const ticket = store.issue(sessionId, command, cwd, decision);

    expect(store.consume(ticket.id, sessionId, command, cwd, decision)).toBe(false);
    expect(store.approve(ticket.id, sessionId, ticket.fingerprint)).toBe(true);
    expect(store.consume(ticket.id, sessionId, command, cwd, decision)).toBe(true);
    expect(store.consume(ticket.id, sessionId, command, cwd, decision)).toBe(false);
  });

  it("binds approval to exact session, command, cwd, and fingerprint", () => {
    const store = new TerminalSealStore(60_000);
    const sessionId = "00000000-0000-4000-8000-000000000001";
    const otherSessionId = "00000000-0000-4000-8000-000000000002";
    const command = "npm run build";
    const cwd = "/workspace/project";
    const decision = reviewCommand(command);
    const ticket = store.issue(sessionId, command, cwd, decision);

    expect(store.approve(ticket.id, sessionId, "not-the-ticket-fingerprint")).toBe(false);
    expect(store.approve(ticket.id, otherSessionId, ticket.fingerprint)).toBe(false);
    expect(store.approve(ticket.id, sessionId, ticket.fingerprint)).toBe(true);
    expect(store.consume(ticket.id, otherSessionId, command, cwd, decision)).toBe(false);
    expect(store.consume(ticket.id, sessionId, "npm publish", cwd, reviewCommand("npm publish"))).toBe(false);
    expect(store.consume(ticket.id, sessionId, command, "/workspace/other", decision)).toBe(false);
  });

  it("rejects expired seals even if the ticket id and fingerprint are correct", () => {
    const store = new TerminalSealStore(0);
    const sessionId = "00000000-0000-4000-8000-000000000001";
    const command = "touch proof.txt";
    const cwd = "/workspace/project";
    const decision = reviewCommand(command);
    const ticket = store.issue(sessionId, command, cwd, decision);

    expect(store.approve(ticket.id, sessionId, ticket.fingerprint)).toBe(false);
    expect(store.consume(ticket.id, sessionId, command, cwd, decision)).toBe(false);
  });

  it("does not require tickets for read-only commands", () => {
    const store = new TerminalSealStore(60_000);
    const decision = reviewCommand("git status");
    expect(store.consume(undefined, "00000000-0000-4000-8000-000000000001", "git status", "/workspace/project", decision)).toBe(true);
  });
});
