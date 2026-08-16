import { redactSensitiveText } from "../shared/redaction";
import type { TerminalSemanticContext, WorkspaceContext } from "./api";
import { readWorkspaceCheckpoint } from "./update-plan";

let terminalContext: TerminalSemanticContext | undefined;

export function publishTerminalContext(context: TerminalSemanticContext) {
  terminalContext = {
    cwd: context.cwd,
    running: context.running,
    outputShared: context.outputShared,
    lastCommand: context.outputShared ? redactSensitiveText(context.lastCommand) : undefined,
    outputTail: context.outputShared ? redactSensitiveText(context.outputTail?.slice(-8000)) : undefined,
  };
}

export function readTerminalContext() {
  return terminalContext;
}

export function buildClientWorkspaceContext(): Omit<WorkspaceContext, "logbook"> | undefined {
  const checkpoint = readWorkspaceCheckpoint();
  if (!checkpoint) return undefined;
  if (!["browser", "ports", "copilot", "terminal", "logbook"].includes(checkpoint.activeModule)) return undefined;
  if (!["browser", "marketing", "logbook"].includes(checkpoint.activeDeck)) return undefined;

  return {
    activeModule: checkpoint.activeModule as WorkspaceContext["activeModule"],
    activeDeck: checkpoint.activeDeck as WorkspaceContext["activeDeck"],
    universeId: checkpoint.universeId,
    currentUrl: checkpoint.url,
    terminal: terminalContext,
  };
}
