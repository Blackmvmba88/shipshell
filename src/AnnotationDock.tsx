import { useEffect, useState } from "react";
import "./annotations.css";

const MODES: Array<{ id: ShipShellAnnotationMode; label: string; title: string }> = [
  { id: "underline", label: "SUB", title: "Subrayar un elemento" },
  { id: "circle", label: "○", title: "Encerrar un elemento" },
  { id: "glow", label: "✦", title: "Marcar un elemento con luz" },
];

export function AnnotationDock() {
  const browser = window.shipShellBrowser;
  const [mode, setMode] = useState<ShipShellAnnotationMode>("off");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!browser || mode === "off") return;
    const timer = window.setInterval(() => {
      browser.getAnnotations().then((anchors) => setCount(anchors.length)).catch(() => undefined);
    }, 700);
    return () => window.clearInterval(timer);
  }, [browser, mode]);

  if (!browser) return null;

  async function select(next: ShipShellAnnotationMode) {
    const resolved = mode === next ? "off" : next;
    const state = await browser.setAnnotationMode(resolved);
    setMode(state.mode);
    setCount(state.anchors.length);
  }

  async function clear() {
    const anchors = await browser.clearAnnotations();
    setCount(anchors.length);
  }

  return (
    <div className="annotation-dock" aria-label="Visual Anchors">
      <span className="annotation-dock-title">ANCHORS</span>
      {MODES.map((item) => (
        <button
          key={item.id}
          className={mode === item.id ? "active" : ""}
          onClick={() => select(item.id)}
          title={item.title}
          aria-pressed={mode === item.id}
        >
          {item.label}
        </button>
      ))}
      <button onClick={clear} title="Limpiar anclas">CLR</button>
      <span className="annotation-count">{count}</span>
    </div>
  );
}
