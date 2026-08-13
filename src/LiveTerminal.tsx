import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Activity, Maximize2, ShieldCheck, TerminalSquare, X } from "lucide-react";
import { api, type TerminalPreview, type TerminalSemanticContext, type TerminalStreamEvent } from "./api";
import "./terminal.css";

const HISTORY_KEY = "shipshell.terminal.history";
const MAX_HISTORY = 100;

function readHistory(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(-MAX_HISTORY)
      : [];
  } catch {
    return [];
  }
}

export function LiveTerminal({
  workspace,
  focused = false,
  onSelect,
  onExpand,
  onContext,
}: {
  workspace?: string;
  focused?: boolean;
  onSelect?: () => void;
  onExpand?: () => void;
  onContext?: (context: TerminalSemanticContext) => void;
}) {
  const sessionId = useRef(window.crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLPreElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [command, setCommand] = useState("git status");
  const [cwd, setCwd] = useState(".");
  const [output, setOutput] = useState("ShipShell Live Terminal\n↑/↓ historial · Ctrl+L limpiar · Ctrl+C detener · Ctrl/Cmd+` enfocar\n\n");
  const [preview, setPreview] = useState<TerminalPreview | null>(null);
  const [running, setRunning] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | undefined>();
  const [history, setHistory] = useState<string[]>(() => readHistory());
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyDraft, setHistoryDraft] = useState("");

  useEffect(() => {
    api.terminalState(sessionId.current).then((state) => setCwd(state.cwd)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const node = outputRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [output]);

  useEffect(() => {
    onContext?.({ cwd, running, lastCommand, outputTail: output.slice(-8000) });
  }, [cwd, running, lastCommand, output, onContext]);

  useEffect(() => {
    if (focused) inputRef.current?.focus();
  }, [focused]);

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "`") {
        event.preventDefault();
        onSelect?.();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && preview) setPreview(null);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [onSelect, preview]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const append = (value: string) => setOutput((current) => `${current}${value}`);

  function remember(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    setLastCommand(normalized);
    setHistory((current) => {
      const next = [...current.filter((item) => item !== normalized), normalized].slice(-MAX_HISTORY);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    setHistoryIndex(null);
    setHistoryDraft("");
  }

  function handleStreamEvent(event: TerminalStreamEvent) {
    if (event.type === "stdout" || event.type === "stderr") append(event.data);
    if (event.type === "clear") setOutput("");
    if (event.type === "cwd") setCwd(event.cwd);
    if (event.type === "error") append(`[error] ${event.message}\n`);
    if (event.type === "exit") {
      setCwd(event.cwd);
      if (event.exitCode && event.exitCode !== 0) append(`\n[exit ${event.exitCode}]\n`);
      else append("\n");
    }
  }

  function stopCurrentProcess() {
    abortRef.current?.abort();
  }

  async function execute(commandToRun: string, sealId?: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setPreview(null);
    remember(commandToRun);
    append(`${cwd} $ ${commandToRun}\n`);
    try {
      await api.runCommandStream(sessionId.current, commandToRun, sealId, handleStreamEvent, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") append("^C\n");
      else append(`[ShipSeal] ${error instanceof Error ? error.message : "Maniobra bloqueada"}\n`);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = command.trim();
    if (!next || running) return;
    onSelect?.();
    try {
      const nextPreview = await api.previewCommand(sessionId.current, next);
      setCwd(nextPreview.cwd);
      if (!nextPreview.decision.allowed) {
        append(`${cwd} $ ${next}\n[ShipSeal] ${nextPreview.decision.reason}\n`);
        remember(next);
        return;
      }
      if (nextPreview.decision.requiresSeal) {
        setPreview(nextPreview);
        return;
      }
      setCommand("");
      await execute(next);
    } catch (error) {
      append(`[terminal] ${error instanceof Error ? error.message : "No pude revisar la maniobra"}\n`);
    }
  }

  async function approveAndRun() {
    if (!preview?.approval) return;
    const commandToRun = command.trim();
    try {
      await api.approveCommand(sessionId.current, preview.approval);
      setCommand("");
      await execute(commandToRun, preview.approval.id);
    } catch (error) {
      append(`[ShipSeal] ${error instanceof Error ? error.message : "No pude sellar la maniobra"}\n`);
      setPreview(null);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setOutput("");
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      if (running && abortRef.current) {
        event.preventDefault();
        stopCurrentProcess();
      }
      return;
    }
    if (event.key === "Escape" && preview) {
      event.preventDefault();
      setPreview(null);
      return;
    }
    if (event.key === "ArrowUp") {
      if (!history.length) return;
      event.preventDefault();
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      if (historyIndex === null) setHistoryDraft(command);
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex]);
      setPreview(null);
      return;
    }
    if (event.key === "ArrowDown" && historyIndex !== null) {
      event.preventDefault();
      if (historyIndex >= history.length - 1) {
        setHistoryIndex(null);
        setCommand(historyDraft);
      } else {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setCommand(history[nextIndex]);
      }
      setPreview(null);
    }
  }

  const risk = preview?.decision.risk;
  const terminalStatus = running ? "EJECUTANDO" : preview ? "SHIPSEAL PENDIENTE" : "VIVA";

  return (
    <section
      className={`terminal-panel live-terminal ${focused ? "module-selected" : ""}`}
      onMouseDown={onSelect}
      onDoubleClick={onExpand}
      data-module="terminal"
    >
      <div className="terminal-title">
        <TerminalSquare size={15} />
        <span>TERMINAL // {workspace ?? "conectando"} // {cwd}</span>
        <button className="module-expand terminal-expand" type="button" onClick={(event) => { event.stopPropagation(); onExpand?.(); }} title="Expandir terminal"><Maximize2 size={13} /></button>
        <span className={running ? "terminal-live running" : "terminal-live"}>{running && <Activity className="spin" size={12} />}{terminalStatus}</span>
      </div>

      <pre ref={outputRef} aria-live="polite">{output}</pre>

      {preview?.approval && <div className={`terminal-seal-preview risk-${risk}`}>
        <ShieldCheck size={17} />
        <div>
          <strong>{risk === "external" ? "MANIOBRA EXTERNA" : "MANIOBRA CON CAMBIOS"}</strong>
          <span>{preview.decision.reason}</span>
          <code>{preview.cwd} $ {command}</code>
          <small>Sello de un solo uso · expira {new Date(preview.approval.expiresAt).toLocaleTimeString()}</small>
        </div>
        <button className="seal-approve" onClick={approveAndRun} disabled={running}>Sellar y ejecutar</button>
        <button className="seal-cancel" onClick={() => setPreview(null)} aria-label="Cancelar maniobra"><X size={14} /></button>
      </div>}

      <form onSubmit={submit}>
        <span>{cwd} $</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(event) => { setCommand(event.target.value); setHistoryIndex(null); if (preview) setPreview(null); }}
          onKeyDown={handleInputKeyDown}
          aria-label="Comando de terminal"
          autoComplete="off"
          spellCheck={false}
          placeholder="git status, npm run build, cd src…"
        />
        {running
          ? <button type="button" className="terminal-stop" onClick={stopCurrentProcess}>Ctrl+C</button>
          : <button disabled={!command.trim()}>Ejecutar</button>}
      </form>
    </section>
  );
}
