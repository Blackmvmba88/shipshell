import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Anchor,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  Layers3,
  Maximize2,
  Megaphone,
  Plus,
  Radio,
  RotateCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { api, type Health, type LogEntry } from "./api";
import { LiveTerminal } from "./LiveTerminal";
import { moduleByShortcut, SHIP_MODULES, type ShipModuleId } from "./modules";
import { applyUniverse, readStoredUniverse, UNIVERSES, type Universe } from "./universes";
import "./copilot.css";
import "./universes.css";
import "./modules.css";

const PORTS = [
  ["Sitio oficial", "https://blackmamba.world", "BM"],
  ["SoundCloud", "https://soundcloud.com", "SC"],
  ["DistroKid", "https://distrokid.com", "DK"],
  ["YouTube", "https://youtube.com", "YT"],
  ["TikTok", "https://tiktok.com", "TK"],
  ["Instagram", "https://instagram.com", "IG"],
] as const;

const QUICK_COPILOT_PROMPTS = [
  "Resume esta página",
  "¿Qué es lo importante aquí?",
  "Explícame lo que estoy viendo",
] as const;

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [copilotInput, setCopilotInput] = useState("");
  const [answer, setAnswer] = useState("Voy contigo. Abre una página y pregúntame lo que quieras sobre ella.");
  const [url, setUrl] = useState("shipshell://home");
  const [busy, setBusy] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(true);
  const [pageContext, setPageContext] = useState<ShipShellPageContext | null>(null);
  const [universe, setUniverse] = useState<Universe>(() => readStoredUniverse());
  const [activeModule, setActiveModule] = useState<ShipModuleId>("browser");
  const [expandedModule, setExpandedModule] = useState<ShipModuleId | null>(null);
  const [activeDeck, setActiveDeck] = useState<"browser" | "marketing" | "logbook">("browser");
  const [browserState, setBrowserState] = useState<ShipShellBrowserState>({ activeTabId: null, tabs: [] });
  const [browserSlot, setBrowserSlot] = useState<HTMLDivElement | null>(null);
  const nativeBrowser = window.shipShellBrowser;

  const activeTab = useMemo(
    () => browserState.tabs.find((tab) => tab.id === browserState.activeTabId) ?? null,
    [browserState],
  );
  const activeModuleMeta = useMemo(() => SHIP_MODULES.find((module) => module.id === activeModule)!, [activeModule]);

  const refresh = async () => {
    const [nextHealth, nextLog] = await Promise.all([api.health(), api.logbook()]);
    setHealth(nextHealth);
    setEntries(nextLog.entries);
  };

  useEffect(() => { refresh().catch(() => undefined); }, []);
  useEffect(() => { applyUniverse(universe); }, [universe]);
  useEffect(() => nativeBrowser?.onState(setBrowserState), [nativeBrowser]);
  useEffect(() => { setPageContext(null); }, [browserState.activeTabId]);

  useEffect(() => {
    const handleModuleShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const module = moduleByShortcut(event.key);
      if (!module) return;
      event.preventDefault();
      selectModule(module);
    };
    window.addEventListener("keydown", handleModuleShortcut);
    return () => window.removeEventListener("keydown", handleModuleShortcut);
  });

  useEffect(() => {
    if (!nativeBrowser) return;
    const browserVisible = activeDeck === "browser" && Boolean(browserSlot) && expandedModule !== "terminal" && expandedModule !== "copilot" && expandedModule !== "logbook";
    nativeBrowser.setVisible(browserVisible);
    if (!browserSlot || !browserVisible) return;
    const updateBounds = () => {
      const rect = browserSlot.getBoundingClientRect();
      nativeBrowser.setBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(updateBounds);
    observer.observe(browserSlot);
    window.addEventListener("resize", updateBounds);
    updateBounds();
    return () => { observer.disconnect(); window.removeEventListener("resize", updateBounds); };
  }, [nativeBrowser, browserSlot, activeDeck, universe.id, expandedModule, activeModule]);

  const status = useMemo(() => health?.aiConfigured ? "COPILOTO EN LÍNEA" : "MODO LOCAL", [health]);

  function selectModule(module: ShipModuleId) {
    setActiveModule(module);
    if (module === "browser" || module === "ports") setActiveDeck("browser");
    if (module === "logbook") setActiveDeck("logbook");
  }

  function toggleModule(module: ShipModuleId) {
    selectModule(module);
    setExpandedModule((current) => current === module ? null : module);
  }

  async function runMission(rawInput: string, includePageContext: boolean) {
    const cleanInput = rawInput.trim();
    if (!cleanInput) return;
    setBusy(true);
    try {
      let context: ShipShellPageContext | undefined;
      if (includePageContext && contextEnabled && nativeBrowser && activeTab) {
        const snapshot = await nativeBrowser.getPageContext();
        setPageContext(snapshot);
        if (snapshot.available) context = snapshot;
      }

      const result = await api.mission(cleanInput, context, {
        universeId: universe.id,
        workMode: universe.workMode,
        voice: universe.voice,
        activeModule,
      });
      if (result.decision.kind === "navigate") {
        setUrl(result.decision.normalizedInput);
        setActiveDeck("browser");
        setActiveModule("browser");
        await nativeBrowser?.navigate(result.decision.normalizedInput);
        setAnswer(`Ruta preparada: ${result.decision.normalizedInput}`);
      } else {
        setAnswer(result.answer ?? "Misión procesada.");
      }
      await refresh();
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "No pude completar la misión.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMission(event: FormEvent) {
    event.preventDefault();
    const mission = input;
    setInput("");
    await runMission(mission, false);
  }

  async function submitCopilot(event: FormEvent) {
    event.preventDefault();
    const mission = copilotInput;
    setCopilotInput("");
    setActiveModule("copilot");
    await runMission(mission, true);
  }

  function openPort(href: string) {
    setUrl(href);
    setActiveDeck("browser");
    setActiveModule("browser");
    if (nativeBrowser) nativeBrowser.navigate(href);
  }

  return (
    <div className="app-shell" data-active-module={activeModule} data-expanded-module={expandedModule ?? "none"}>
      <div className="universe-stage" aria-hidden="true" />

      <header className="topbar">
        <div className="brand"><div className="mark">S</div><div><strong>BLACKMAMBA</strong><span>SHIPSHELL</span></div></div>
        <form className="radar" onSubmit={submitMission}>
          <Radio size={16} />
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Busca o escribe una URL…" aria-label="Radar inteligente" />
          <button disabled={busy} aria-label="Iniciar misión">{busy ? <Activity className="spin" size={17} /> : <Send size={17} />}</button>
        </form>
        <div className="system-status"><span className="pulse" />{status} · {universe.workMode.toUpperCase()}</div>
        <div className="module-status" title={activeModuleMeta.description}><strong>{activeModuleMeta.label}</strong><span>ALT+{activeModuleMeta.shortcut}</span></div>
      </header>

      <aside className="rail">
        <button className={activeDeck === "browser" ? "active" : ""} onClick={() => { setActiveDeck("browser"); selectModule("browser"); }}><Compass /><span>Puente</span></button>
        <button className={activeDeck === "marketing" ? "active" : ""} onClick={() => setActiveDeck("marketing")}><Megaphone /><span>Marketing</span></button>
        <button className={activeDeck === "logbook" ? "active" : ""} onClick={() => { setActiveDeck("logbook"); selectModule("logbook"); }}><BookOpen /><span>Bitácora</span></button>
      </aside>

      <main className="workspace">
        <section className={`browser-panel selectable-module ${activeModule === "browser" || activeModule === "ports" || activeModule === "logbook" ? "module-selected" : ""}`} data-module={activeDeck === "logbook" ? "logbook" : "browser"} onMouseDown={() => selectModule(activeDeck === "logbook" ? "logbook" : "browser")} onDoubleClick={() => toggleModule(activeDeck === "logbook" ? "logbook" : "browser")}>
          <div className="panel-heading">
            <div><span className="eyebrow">PUENTE DE MANDO</span><h1>{activeDeck === "browser" ? "Navegación" : activeDeck === "marketing" ? "Cubierta de Marketing" : "Bitácora"}</h1></div>
            <div className="panel-actions"><button className="module-expand" onClick={(event) => { event.stopPropagation(); toggleModule(activeDeck === "logbook" ? "logbook" : "browser"); }} title="Expandir módulo"><Maximize2 size={13} /></button><div className="secure"><ShieldCheck size={15} /> ShipSeal activo</div></div>
          </div>

          {activeDeck === "browser" && <>
            <div className={`ports selectable-submodule ${activeModule === "ports" ? "module-selected" : ""}`} data-module="ports" onMouseDown={(event) => { event.stopPropagation(); selectModule("ports"); }} onDoubleClick={(event) => { event.stopPropagation(); toggleModule("ports"); }}>
              {PORTS.map(([name, href, icon]) => <button key={name} onClick={() => openPort(href)}><span>{icon}</span><div><strong>{name}</strong><small>ABRIR PUERTO</small></div></button>)}
            </div>
            <div className="browser-frame" data-module="browser" onMouseDown={() => selectModule("browser")}>
              {nativeBrowser && browserState.tabs.length > 0 && <div className="tab-strip">
                {browserState.tabs.map((tab) => <button className={tab.id === browserState.activeTabId ? "active" : ""} key={tab.id} onClick={() => nativeBrowser.selectTab(tab.id)}><span>{tab.loading ? "◌" : "●"}</span><strong>{tab.title}</strong><X size={12} onClick={(event) => { event.stopPropagation(); nativeBrowser.closeTab(tab.id); }} /></button>)}
                <button className="new-tab" onClick={() => nativeBrowser.newTab("https://www.google.com")}><Plus size={14} /></button>
              </div>}
              <div className="browser-toolbar">
                {nativeBrowser && <><button onClick={() => nativeBrowser.back()} disabled={!activeTab?.canGoBack}><ArrowLeft size={14} /></button><button onClick={() => nativeBrowser.forward()} disabled={!activeTab?.canGoForward}><ArrowRight size={14} /></button><button onClick={() => nativeBrowser.reload()}><RotateCw size={13} /></button></>}
                <Globe2 size={15} /><span>{activeTab?.url ?? url}</span>{!nativeBrowser && url.startsWith("http") && <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir en navegador"><ExternalLink size={15} /></a>}
              </div>
              {nativeBrowser && browserState.tabs.length > 0 ? <div className="native-browser-slot" ref={setBrowserSlot} /> : url === "shipshell://home" ? <div className="ship-home">
                <div className="horizon" />
                <Anchor />
                <span>BLACKMAMBA // SHIPSHELL</span>
                <h2>Tu internet.<br />Tu copiloto al lado.</h2>
                <p>Abre una página. ShipShell Copilot se queda contigo mientras navegas y usa el contexto sólo cuando tú lo permites.</p>
                <div><ShieldCheck size={14} /> Navegación bajo ShipSeal</div>
              </div> : <div className="web-preview"><Globe2 /><h3>La navegación real vive en ShipShell Desktop</h3><p>Ejecuta <code>npm run desktop:dev</code> para abrir páginas completas dentro del navegador propio.</p><a href={url} target="_blank" rel="noreferrer">Abrir temporalmente ↗</a></div>}
            </div>
          </>}

          {activeDeck === "marketing" && <div className="empty-state"><Megaphone /><h2>Centro de campañas listo</h2><p>Conecta un puerto para traer promociones reales. ShipShell no inventará métricas ni campañas.</p><button onClick={() => setActiveDeck("browser")}>Conectar primer puerto</button></div>}

          {activeDeck === "logbook" && <div className="log-list" data-module="logbook">{entries.length ? entries.map((entry) => <article key={entry.id}><span className={`log-dot ${entry.status}`} /><div><strong>{entry.summary}</strong><small>{entry.event.toUpperCase()} · {new Date(entry.createdAt).toLocaleString()}</small></div></article>) : <div className="empty-state"><BookOpen /><h2>Bitácora limpia</h2><p>Las misiones y maniobras verificables aparecerán aquí.</p></div>}</div>}
        </section>

        <aside className={`crew-panel copilot-panel selectable-module ${activeModule === "copilot" ? "module-selected" : ""}`} data-module="copilot" onMouseDown={() => selectModule("copilot")} onDoubleClick={() => toggleModule("copilot")}>
          <div className="crew-title copilot-title"><Bot /><div><span>COPILOTO</span><strong>ShipShell Copilot</strong></div><button className="module-expand" onClick={(event) => { event.stopPropagation(); toggleModule("copilot"); }} title="Expandir módulo"><Maximize2 size={13} /></button><span className="pulse" /></div>

          <section className="universe-switcher" aria-label="Universo de ShipShell">
            <div className="universe-switcher-head"><div><span>UNIVERSO</span><strong>{universe.name}</strong></div><Layers3 size={16} /></div>
            <select value={universe.id} onChange={(event) => setUniverse(UNIVERSES.find((item) => item.id === event.target.value) ?? universe)} aria-label="Cambiar universo">
              {UNIVERSES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <div className="universe-meta">
              <div><span>Modo</span><strong>{universe.workMode}</strong></div>
              <div><span>Voz</span><strong>{universe.voice}</strong></div>
              <div><span>Atmósfera</span><strong>{universe.shader}</strong></div>
            </div>
            <p className="universe-description">{universe.description}</p>
          </section>

          <div className="copilot-context-card">
            <div className="context-source">
              <Globe2 size={16} />
              <div><span>PÁGINA ACTIVA</span><strong>{activeTab?.title ?? "Sin pestaña activa"}</strong><small>{activeTab?.url ?? "Abre un puerto para navegar"}</small></div>
            </div>
            <button className={`context-toggle ${contextEnabled ? "on" : ""}`} onClick={() => setContextEnabled((enabled) => !enabled)} title="Controlar si el copiloto puede leer una instantánea de la pestaña al preguntar">
              {contextEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
              Contexto {contextEnabled ? "ON" : "OFF"}
            </button>
            {pageContext?.selection && <div className="selection-chip">Selección incluida</div>}
          </div>

          <div className="copilot-quick-actions">
            {QUICK_COPILOT_PROMPTS.map((prompt) => <button key={prompt} disabled={busy || !activeTab || !contextEnabled} onClick={() => runMission(prompt, true)}>{prompt}</button>)}
          </div>

          <div className="message copilot-message"><span>{pageContext?.available ? "CONTEXTO DE PÁGINA + RESPUESTA" : "COPILOTO"}</span><p>{answer}</p></div>

          <form className="copilot-form" onSubmit={submitCopilot}>
            <Sparkles size={16} />
            <textarea value={copilotInput} onChange={(event) => setCopilotInput(event.target.value)} placeholder="Pregúntame sobre esta página…" aria-label="Preguntar al copiloto" rows={3} />
            <button disabled={busy || !copilotInput.trim()} aria-label="Preguntar al copiloto">{busy ? <Activity className="spin" size={16} /> : <Send size={16} />}</button>
          </form>

          <div className="evidence"><CheckCircle2 /><div><strong>Copiloto, no piloto automático</strong><span>Puede ver, entender y proponer. Publicar, comprar, borrar, enviar o modificar cuentas sigue requiriendo ShipSeal.</span></div></div>
          <div className="mission-stats"><div><span>MISIONES</span><strong>{entries.filter((e) => e.event === "mission").length}</strong></div><div><span>BLOQUEOS</span><strong>{entries.filter((e) => e.status === "blocked").length}</strong></div></div>
        </aside>

        <LiveTerminal workspace={health?.workspace} focused={activeModule === "terminal"} onSelect={() => setActiveModule("terminal")} />
      </main>
    </div>
  );
}

export default App;
