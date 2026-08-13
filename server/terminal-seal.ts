import { createHash, randomUUID } from "node:crypto";
import type { CommandDecision } from "./guard.js";

interface Ticket {
  id: string;
  sessionId: string;
  fingerprint: string;
  command: string;
  cwd: string;
  approved: boolean;
  expiresAt: number;
  used: boolean;
}

export interface PublicSealTicket {
  id: string;
  fingerprint: string;
  expiresAt: string;
}

function fingerprint(sessionId: string, command: string, cwd: string, decision: CommandDecision): string {
  return createHash("sha256")
    .update(JSON.stringify({ sessionId, command, cwd, risk: decision.risk, executable: decision.executable, args: decision.args, builtin: decision.builtin }))
    .digest("hex");
}

export class TerminalSealStore {
  private readonly tickets = new Map<string, Ticket>();
  constructor(private readonly ttlMs = 60_000) {}

  issue(sessionId: string, command: string, cwd: string, decision: CommandDecision): PublicSealTicket {
    this.prune();
    const ticket: Ticket = {
      id: randomUUID(),
      sessionId,
      fingerprint: fingerprint(sessionId, command, cwd, decision),
      command,
      cwd,
      approved: false,
      expiresAt: Date.now() + this.ttlMs,
      used: false,
    };
    this.tickets.set(ticket.id, ticket);
    return { id: ticket.id, fingerprint: ticket.fingerprint, expiresAt: new Date(ticket.expiresAt).toISOString() };
  }

  approve(id: string, providedFingerprint: string): boolean {
    this.prune();
    const ticket = this.tickets.get(id);
    if (!ticket || ticket.used || ticket.fingerprint !== providedFingerprint) return false;
    ticket.approved = true;
    return true;
  }

  consume(id: string | undefined, sessionId: string, command: string, cwd: string, decision: CommandDecision): boolean {
    if (!decision.requiresSeal) return true;
    if (!id) return false;
    this.prune();
    const ticket = this.tickets.get(id);
    if (!ticket || ticket.used || !ticket.approved) return false;
    const expected = fingerprint(sessionId, command, cwd, decision);
    if (ticket.sessionId !== sessionId || ticket.command !== command || ticket.cwd !== cwd || ticket.fingerprint !== expected) return false;
    ticket.used = true;
    return true;
  }

  private prune() {
    const now = Date.now();
    for (const [id, ticket] of this.tickets) {
      if (ticket.expiresAt <= now || ticket.used) this.tickets.delete(id);
    }
  }
}
