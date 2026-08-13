import { FormEvent, useEffect, useRef, useState } from "react";
import { Activity, ShieldCheck, TerminalSquare, X } from "lucide-react";
import { api, type TerminalPreview, type TerminalStreamEvent } from "./api";
import "./terminal.css";

export function LiveTerminal({ workspace }: { workspace?: string }) {
  const [command, setCommand] = useState("git status");
  const [cwd, setCwd] = useState(".");
  const [output, setOutput] = useState("ShipShell Live Terminal\nLecturas directas · mutaciones bajo ShipSeal\n\n");
  const [preview, setPreview] = useState<TerminalPreview | null>(null);
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    api.terminalState().then((state) => setCwd(state.cwd)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const node = outputRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [output]);

  const append = (value: string) => setOutput((current) => `${current}${value}`);

  function handleStreamEvent(event: TerminalStreamEvent) {
    if (event.type === "stdout" || event.type === "stderr") append(event.data);
    if (event.type === "clear") setOutput("");
    if (event.type === "cwd") setCwd(event.cwd);
    if (event.type === "error") append(`[error] ${event.message}\n`);
    if (event.type === "exit") {
      setCwd(event.cwd);
      if (event.exitCode && event.exitCode !== 0) append(`\n[exit ${event.exitCode}]\n`);
      else if (output && !output.endsWith("\n")) append("\n");
    }
  }

  async function execute(commandToRun: string, sealId?: string) {
    setRunning(true);
    setPreview(null);
    append(`${cwd} $ ${commandToRun}\n`);
    try {
      await api.runCommandStream(commandToRun, sealId, handleStreamEvent);
    } catch (error) {
      append(`[ShipSeal] ${error instanceof Error ? error.message : "Maniobra bloqueada"}\n`);
    } finally {
      setRunning(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = command.trim();
    if (!next || running) return;
    try {
      const nextPreview = await api.previewCommand(next);
      if (!nextPreview.decision.allowed) {
        append(`${cwd} $ ${next}\n[ShipSeal] ${nextPreview.decision.reason}\n`);
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
      await api.approveCommand(preview.approval);
      setCommand("");
      await execute(commandToRun, preview.approval.id);
    } catch (error) {
      append(`[ShipSeal] ${error instanceof Error ? error.message : "No pude sellar la maniobra"}\n`);
      setPreview(null);
    }
  }

  const risk = preview?.decision.risk;
  const terminalStatus = running ? "EJECUTANDO" : preview ? "SHIPSEAL PENDIENTE" : "VIVA";

  return (
    <section className="terminal-panel live-terminal">
      <div className="terminal-title">
        <TerminalSquare size={15} />
        <span>TERMINAL // {workspace ?? "conectando"} // {cwd}</span>
        <span className={running ? "terminal-live running" : "terminal-live"}>{running && <Activity className="spin" size={12} />}{terminalStatus}</span>
      </div>

      <pre ref={outputRef} aria-live="polite">{output}</pre>

      {preview?.approval && <div className={`terminal-seal-preview risk-${risk}`}>
        <ShieldCheck size={17} />
        <div>
          <strong>{risk === "external" ? "MANIOBRA EXTERNA" : "MANIOBRA CON CAMBIOS"}</strong>
          <span>{preview.decision.reason}</span>
          <code>{cwd} $ {command}</code>
          <small>Sello de un solo uso · expira {new Date(preview.approval.expiresAt).toLocaleTimeString()}</small>
        </div>
        <button className="seal-approve" onClick={approveAndRun} disabled={running}>Sellar y ejecutar</button>
        <button className="seal-cancel" onClick={() => setPreview(null)} aria-label="Cancelar maniobra"><X size={14} /></button>
      </div>}

      <form onSubmit={submit}>
        <span>{cwd} $</span>
        <input
          value={command}
          onChange={(event) => { setCommand(event.target.value); if (preview) setPreview(null); }}
          aria-label="Comando de terminal"
          autoComplete="off"
          spellCheck={false}
          disabled={running}
          placeholder="git status, npm run build, cd src…"
        />
        <button disabled={running || !command.trim()}>{running ? "Corriendo…" : "Ejecutar"}</button>
      </form>
    </section>
  );
}
