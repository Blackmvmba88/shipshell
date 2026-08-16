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
import { readWorkspaceCheckpoint, saveWorkspaceCheckpoint } from "./update-plan";
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

type DeckId = "browser" | "marketing" | "logbook";

function isModuleId(value: string | null | undefined): value is ShipModuleId {
  return SHIP_MODULES.some((module) => module.id === value);
}

function isDeckId(value: string | undefined): value is DeckId {
  return value === "browser" || value === "marketing" || value === "logbook";
}

function anchorNumbersFromAnswer(text: string) {
  const found = new Set<number>();
  const pattern = /\b(?:ancla|anchor)\s*#?\s*(\d{1,2})\b/gi;
  for (const match of text.matchAll(pattern)) {
    const number = Number(match[1]);
    if (Number.isInteger(number) && number >= 1 && number <= 24) found.add(number);
  }
  return [...found];
}

function restoreWorkspace() {
  const checkpoint = readWorkspaceCheckpoint();
  const storedUniverse = readStoredUniverse();
  const universe = checkpoint
    ? UNIVERSES.find((candidate) => candidate.id === checkpoint.universeId) ?? storedUniverse
    : storedUniverse;
  return {
    universe,
    activeModule: isModuleId(checkpoint?.activeModule) ? checkpoint.activeModule : "browser" as ShipModuleId,
    expandedModule: isModuleId(checkpoint?.expandedModule) ? checkpoint.expandedModule : null,
    activeDeck: isDeckId(checkpoint?.activeDeck) ? checkpoint.activeDeck : "browser" as DeckId,
    url: checkpoint?.url || "shipshell://home",
  };
}

function App() {
  const [boot] = useState(() => restoreWorkspace());
  const [health, setHealth] = useState<Health | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [copilotInput, setCopilotInput] = useState("");
  const [answer, setAnswer] = useState("ShipShell listo. Abre una página o define una misión.");
  const [url, setUrl] = useState(boot.url);
  const [busy, setBusy] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(true);
  const [pageContext, setPageContext] = useState<ShipShellPageContext | null>(null);
  const [universe, setUniverse] = useState<Universe>(boot.universe);
  const [activeModule, setActiveModule] = useState<ShipModuleId>(boot.activeModule);
  const [expandedModule, setExpandedModule] = useState<ShipModuleId | null>(boot.expandedModule);
  const [activeDeck, setActiveDeck] = useState<DeckId>(boot.activeDeck);
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
    saveWorkspaceCheckpoint({
      activeModule,
      expandedModule,
      universeId: universe.id,
      activeDeck,
      url: activeTab?.url ?? url,
    });
  }, [activeModule, expandedModule, universe.id, activeDeck, activeTab?.url, url]);

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
    const handleAskAnchors = (event: Event) => {
      const numbers = (event as CustomEvent<{ numbers?: number[] }>).detail?.numbers
        ?.map(Number)
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 24) ?? [];
      if (!numbers.length || busy) return;
      setActiveModule("copilot");
      const labels = numbers.map((number) => `Ancla ${number}`).join(", ");
      void runMission(`Compara ${labels}. Usa sus notas y contexto visual/semántico, explica las diferencias importantes y recomienda sólo si hay evidencia suficiente.`, true);
    };
    window.addEventListener("shipshell:ask-anchors", handleAskAnchors);
    return () => window.removeEventListener("shipshell:ask-anchors", handleAskAnchors);
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

  const status = useMemo(() => {
    if (!health) return "Conectando";
    return health.aiConfigured ? "AI conectada" : "Modo local";
  }, [health]);

  function selectModule(module: ShipModuleId) {
    setActiveModule(module);
    setExpandedModule((current) => current && current !== module ? null : current);
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
        setExpandedModule(null);
        await nativeBrowser?.navigate(result.decision.normalizedInput);
        setAnswer(`Ruta preparada: ${result.decision.normalizedInput}`);
      } else {
        const nextAnswer = result.answer ?? "Misión procesada.";
        setAnswer(nextAnswer);
        const referencedAnchors = anchorNumbersFromAnswer(nextAnswer);
        if (referencedAnchors.length) await nativeBrowser?.focusAnnotations(referencedAnchors);
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

  async function runCopilotPrompt(prompt: string) {
    setActiveModule("copilot");
    await runMission(prompt, true);
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
    setExpandedModule(null);
    if (nativeBrowser) nativeBrowser.navigate(href);
  }

  return (
    <div className="app-shell" data-active-module={activeModule} data-expanded-module={expandedModule ?? "none"}>
      <div className="universe-stage" aria-hidden="true" />

      <header className="topbar">
        <div className="brand" aria-label="BlackMamba ShipShell">
          <div className="mark">S</div>
          <div><strong>ShipShell</strong><span>BlackMamba Systems</span></div>
        </div>
        <form className="radar" onSubmit={submitMission}>
          <Radio size={16} aria-hidden="true" />
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Buscar, preguntar o abrir una URL…" aria-label="Comando global" />
          <button disabled={busy} aria-label="Ejecutar misión">{busy ? <Activity className="spin" size={17} /> : <Send size={17} />}</button>
        </form>
        <div className="system-status"><span className="pulse" />{status} · {universe.name}</div>
        <div className="module-status" title={activeModuleMeta.description}><strong>{activeModuleMeta.label}</strong><span>ALT+{activeModuleMeta.shortcut}</span></div>
      </header>

      <aside className="rail" aria-label="Navegación principal">
        <button aria-current={activeDeck === "browser" ? "page" : undefined} className={activeDeck === "browser" ? "active" : ""} onClick={() => { setActiveDeck("browser"); selectModule("browser"); }}><Compass /><span>Navegador</span></button>
        <button aria-current={activeDeck === "marketing" ? "page" : undefined} className={activeDeck === "marketing" ? "active" : ""} onClick={() => setActiveDeck("marketing")}><Megaphone /><span>Campañas</span></button>
        <button aria-current={activeDeck === "logbook" ? "page" : undefined} className={activeDeck === "logbook" ? "active" : ""} onClick={() => { setActiveDeck("logbook"); selectModule("logbook"); }}><BookOpen /><span>Bitácora</span></button>
      </aside>

      <main className="workspace">
        <section className={`browser-panel selectable-module ${activeModule === "browser" || activeModule === "ports" || activeModule === "logbook" ? "module-selected" : ""}`} data-module={activeDeck === "logbook" ? "logbook" : "browser"} onMouseDown={() => selectModule(activeDeck === "logbook" ? "logbook" : "browser")} onDoubleClick={() => toggleModule(activeDeck === "logbook" ? "logbook" : "browser")}>
          <div className="panel-heading">
            <div><span className="eyebrow">Workspace</span><h1>{activeDeck === "browser" ? "Navegador" : activeDeck === "marketing" ? "Campañas" : "Bitácora"}</h1></div>
            <div className="panel-actions"><button className="module-expand" onClick={(event) => { event.stopPropagation(); toggleModule(activeDeck === "logbook" ? "logbook" : "browser"); }} title="Expandir módulo" aria-label="Expandir módulo"><Maximize2 size={13} /></button><div className="secure"><ShieldCheck size={15} /> ShipSeal protegido</div></div>
          </div>

          {activeDeck === "browser" && <>
            <div className={`ports selectable-submodule ${activeModule === "ports" ? "module-selected" : ""}`} data-module="ports" onMouseDown={(event) => { event.stopPropagation(); selectModule("ports"); }} onDoubleClick={(event) => { event.stopPropagation(); toggleModule("ports"); }}>
              {PORTS.map(([name, href, icon]) => <button type="button" key={name} onClick={() => openPort(href)}><span>{icon}</span><div><strong>{name}</strong><small>Abrir</small></div></button>)}
            </div>
            <div className="browser-frame" data-module="browser" onMouseDown={() => selectModule("browser")}>
              {nativeBrowser && browserState.tabs.length > 0 && <div className="tab-strip">
                {browserState.tabs.map((tab) => <button className={tab.id === browserState.activeTabId ? "active" : ""} key={tab.id} onClick={() => nativeBrowser.selectTab(tab.id)}><span>{tab.loading ? "◌" : "●"}</span><strong>{tab.title}</strong><X aria-label={`Cerrar ${tab.title}`} size={12} onClick={(event) => { event.stopPropagation(); nativeBrowser.closeTab(tab.id); }} /></button>)}
                <button className="new-tab" aria-label="Nueva pestaña" onClick={() => nativeBrowser.newTab("https://www.google.com")}><Plus size={14} /></button>
              </div>}
              <div className="browser-toolbar">
                {nativeBrowser && <>
                  <button aria-label="Atrás" onClick={() => nativeBrowser.back()} disabled={!activeTab?.canGoBack}><ArrowLeft size={14} /></button>
                  <button aria-label="Adelante" onClick={() => nativeBrowser.forward()} disabled={!activeTab?.canGoForward}><ArrowRight size={14} /></button>
                  <button aria-label="Recargar" onClick={() => nativeBrowser.reload()}><RotateCw size={13} /></button>
                </>}
                <Globe2 size={15} aria-hidden="true" /><span>{activeTab?.url ?? url}</span>{!nativeBrowser && url.startsWith("http") && <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir en navegador"><ExternalLink size={15} /></a>}
              </div>
              {nativeBrowser && browserState.tabs.length > 0 ? <div className="native-browser-slot" ref={setBrowserSlot} /> : url === "shipshell://home" ? <div className="ship-home">
                <div className="horizon" />
                <Anchor />
                <span>ShipShell Workspace</span>
                <h2>Navega. Analiza.<br />Actúa con control.</h2>
                <p>Un espacio de trabajo para navegar, consultar a tu Copilot y ejecutar acciones con límites claros y evidencia verificable.</p>
                <div><ShieldCheck size={14} /> Acciones sensibles requieren aprobación</div>
              </div> : <div className="web-preview"><Globe2 /><h3>Navegación disponible en ShipShell Desktop</h3><p>Ejecuta <code>npm run desktop:dev</code> para abrir páginas completas dentro del navegador integrado.</p><a href={url} target="_blank" rel="noreferrer">Abrir temporalmente ↗</a></div>}
            </div>
          </>}

          {activeDeck === "marketing" && <div className="empty-state"><Megaphone /><h2>Campañas</h2><p>Conecta un puerto para trabajar con promociones y métricas verificables. ShipShell no completa datos que no existan.</p><button onClick={() => setActiveDeck("browser")}>Conectar un puerto</button></div>}

          {activeDeck === "logbook" && <div className="log-list" data-module="logbook">{entries.length ? entries.map((entry) => <article key={entry.id}><span className={`log-dot ${entry.status}`} /><div><strong>{entry.summary}</strong><small>{entry.event} · {new Date(entry.createdAt).toLocaleString()}</small></div></article>) : <div className="empty-state"><BookOpen /><h2>Sin actividad registrada</h2><p>Las misiones y acciones verificables aparecerán aquí.</p></div>}</div>}
        </section>

        <aside className={`crew-panel copilot-panel selectable-module ${activeModule === "copilot" ? "module-selected" : ""}`} data-module="copilot" onMouseDown={() => selectModule("copilot")} onDoubleClick={() => toggleModule("copilot")}>
          <div className="crew-title copilot-title"><Bot /><div><span>Copilot</span><strong>ShipShell Copilot</strong></div><button className="module-expand" onClick={(event) => { event.stopPropagation(); toggleModule("copilot"); }} title="Expandir Copilot" aria-label="Expandir Copilot"><Maximize2 size={13} /></button><span className="pulse" /></div>

          <section className="universe-switcher" aria-label="Universo de ShipShell">
            <div className="universe-switcher-head"><div><span>Universo</span><strong>{universe.name}</strong></div><Layers3 size={16} /></div>
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
              <div><span>Página activa</span><strong>{activeTab?.title ?? "Sin pestaña activa"}</strong><small>{activeTab?.url ?? "Abre un puerto para navegar"}</small></div>
            </div>
            <button className={`context-toggle ${contextEnabled ? "on" : ""}`} onClick={() => setContextEnabled((enabled) => !enabled)} title="Controlar si el Copilot puede leer una instantánea de la pestaña al preguntar">
              {contextEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
              Contexto {contextEnabled ? "activo" : "inactivo"}
            </button>
            {pageContext?.selection && <div className="selection-chip">Selección incluida</div>}
            {pageContext?.anchors?.length ? <div className="selection-chip">{pageContext.anchors.length} anclas espaciales</div> : null}
          </div>

          <div className="copilot-quick-actions">
            {QUICK_COPILOT_PROMPTS.map((prompt) => <button key={prompt} disabled={busy || !activeTab || !contextEnabled} onClick={() => runCopilotPrompt(prompt)}>{prompt}</button>)}
          </div>

          <div className="message copilot-message"><span>{pageContext?.available ? "Contexto activo" : "Copilot"}</span><p>{answer}</p></div>

          <form className="copilot-form" onSubmit={submitCopilot}>
            <Sparkles size={16} />
            <textarea value={copilotInput} onChange={(event) => setCopilotInput(event.target.value)} placeholder="Pregúntame sobre esta página…" aria-label="Preguntar al Copilot" rows={3} />
            <button disabled={busy || !copilotInput.trim()} aria-label="Preguntar al Copilot">{busy ? <Activity className="spin" size={16} /> : <Send size={16} />}</button>
          </form>

          <div className="evidence"><CheckCircle2 /><div><strong>Acciones sensibles protegidas</strong><span>El Copilot puede observar, explicar, señalar y proponer. Publicar, comprar, borrar, enviar o modificar cuentas sigue requiriendo ShipSeal.</span></div></div>
          <div className="mission-stats"><div><span>Misiones</span><strong>{entries.filter((e) => e.event === "mission").length}</strong></div><div><span>Bloqueos</span><strong>{entries.filter((e) => e.status === "blocked").length}</strong></div></div>
        </aside>

        <LiveTerminal
          workspace={health?.workspace}
          focused={activeModule === "terminal"}
          onSelect={() => selectModule("terminal")}
          onExpand={() => toggleModule("terminal")}
        />
      </main>
    </div>
  );
}

export default App;
