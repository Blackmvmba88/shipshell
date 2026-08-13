import { useEffect, useMemo, useState } from "react";
import "./annotations.css";

const MODES: Array<{ id: ShipShellAnnotationMode; label: string; title: string }> = [
  { id: "underline", label: "SUB", title: "Subrayar un elemento" },
  { id: "circle", label: "○", title: "Encerrar un elemento" },
  { id: "glow", label: "✦", title: "Marcar un elemento con luz" },
];

export function AnnotationDock() {
  const browser = window.shipShellBrowser;
  const [mode, setMode] = useState<ShipShellAnnotationMode>("off");
  const [anchors, setAnchors] = useState<ShipShellVisualAnchor[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (!browser) return;
    let cancelled = false;
    const refresh = () => browser.getAnnotations()
      .then((next) => { if (!cancelled) setAnchors(next); })
      .catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 700);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [browser]);

  useEffect(() => {
    setSelected((current) => current.filter((number) => number <= anchors.length));
  }, [anchors.length]);

  const selectedAnchor = useMemo(
    () => selected.length === 1 ? anchors[selected[0] - 1] : undefined,
    [anchors, selected],
  );

  if (!browser) return null;
  const bridge = browser;

  async function selectMode(next: ShipShellAnnotationMode) {
    const resolved = mode === next ? "off" : next;
    const state = await bridge.setAnnotationMode(resolved);
    setMode(state.mode);
    setAnchors(state.anchors);
  }

  async function clear() {
    const next = await bridge.clearAnnotations();
    setAnchors(next);
    setSelected([]);
  }

  async function toggleAnchor(number: number) {
    setSelected((current) => current.includes(number)
      ? current.filter((item) => item !== number)
      : [...current, number].sort((a, b) => a - b));
    await bridge.focusAnnotations([number]);
  }

  async function saveNote(note: string) {
    if (selected.length !== 1) return;
    const next = await bridge.setAnnotationNote(selected[0], note);
    setAnchors(next);
  }

  function askSelected() {
    if (!selected.length) return;
    window.dispatchEvent(new CustomEvent("shipshell:ask-anchors", {
      detail: { numbers: selected },
    }));
  }

  return (
    <div className="annotation-shell" aria-label="Spatial Copilot">
      <div className="annotation-dock">
        <span className="annotation-dock-title">ANCHORS</span>
        {MODES.map((item) => (
          <button
            key={item.id}
            className={mode === item.id ? "active" : ""}
            onClick={() => selectMode(item.id)}
            title={item.title}
            aria-pressed={mode === item.id}
          >
            {item.label}
          </button>
        ))}
        <button onClick={clear} title="Limpiar anclas">CLR</button>
        <span className="annotation-count">{anchors.length}</span>
      </div>

      {anchors.length > 0 && (
        <div className="annotation-tray">
          <div className="annotation-chips" aria-label="Anclas marcadas">
            {anchors.map((anchor, index) => {
              const number = index + 1;
              return (
                <button
                  key={anchor.id}
                  className={`${selected.includes(number) ? "selected" : ""} ${anchor.resolved === false ? "unresolved" : ""}`}
                  onClick={() => toggleAnchor(number)}
                  title={anchor.note || anchor.ariaLabel || anchor.text || `Ancla ${number}`}
                >
                  {number}
                </button>
              );
            })}
          </div>
          <button className="annotation-ask" disabled={!selected.length} onClick={askSelected}>
            ASK {selected.length ? selected.join("·") : ""}
          </button>
          {selectedAnchor && (
            <input
              key={`${selected[0]}:${selectedAnchor.note ?? ""}`}
              className="annotation-note"
              defaultValue={selectedAnchor.note ?? ""}
              placeholder={`Nota para ancla ${selected[0]}`}
              maxLength={500}
              onBlur={(event) => saveNote(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
