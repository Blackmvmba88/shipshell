import { app, BrowserWindow, WebContentsView, ipcMain, session } from "electron";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const preload = path.join(here, "preload.cjs");
const partition = "persist:shipshell";
const annotationModes = new Set(["off", "underline", "circle", "glow"]);

let shellWindow;
let activeTabId = null;
let browserBounds = { x: 103, y: 331, width: 900, height: 420 };
let browserVisible = true;
let annotationMode = "off";
const tabs = new Map();

const publicTab = (tab) => ({
  id: tab.id,
  title: tab.title || "Nueva travesía",
  url: tab.url,
  loading: tab.loading,
  canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
  canGoForward: tab.view.webContents.navigationHistory.canGoForward(),
});

function publishState() {
  if (!shellWindow || shellWindow.isDestroyed()) return;
  shellWindow.webContents.send("browser:state", {
    activeTabId,
    tabs: [...tabs.values()].map(publicTab),
  });
}

function activateTab(id) {
  if (!tabs.has(id)) return;
  activeTabId = id;
  for (const tab of tabs.values()) {
    tab.view.setVisible(browserVisible && tab.id === id);
    if (tab.id === id) tab.view.setBounds(browserBounds);
  }
  if (annotationMode !== "off") applyAnnotationMode(activeContents(), annotationMode).catch(() => undefined);
  publishState();
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(raw)) return `http://${raw}`;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
}

function isWebUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function createTab(requestedUrl) {
  const url = normalizeUrl(requestedUrl || "https://www.google.com");
  const id = crypto.randomUUID();
  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      partition,
      safeDialogs: true,
    },
  });
  const tab = { id, view, url, title: "Cargando…", loading: true };
  tabs.set(id, tab);
  shellWindow.contentView.addChildView(view);
  view.setBounds(browserBounds);

  const sync = () => {
    tab.url = view.webContents.getURL() || tab.url;
    tab.title = view.webContents.getTitle() || tab.title;
    publishState();
  };
  view.webContents.on("did-start-loading", () => { tab.loading = true; sync(); });
  view.webContents.on("did-stop-loading", () => {
    tab.loading = false;
    sync();
    if (tab.id === activeTabId && annotationMode !== "off") applyAnnotationMode(view.webContents, annotationMode).catch(() => undefined);
  });
  view.webContents.on("page-title-updated", (_event, title) => { tab.title = title; publishState(); });
  view.webContents.on("did-navigate", sync);
  view.webContents.on("did-navigate-in-page", sync);
  view.webContents.on("will-navigate", (event, destination) => {
    if (!isWebUrl(destination)) event.preventDefault();
  });
  view.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
    if (isWebUrl(popupUrl)) createTab(popupUrl);
    return { action: "deny" };
  });

  view.webContents.loadURL(url);
  activateTab(id);
  return publicTab(tab);
}

function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  shellWindow.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  tabs.delete(id);
  if (activeTabId === id) {
    const next = [...tabs.keys()].at(-1) ?? null;
    activeTabId = next;
    if (next) activateTab(next); else publishState();
  }
}

function activeContents() {
  return activeTabId ? tabs.get(activeTabId)?.view.webContents : undefined;
}

function annotationBootstrap(mode) {
  return `(() => {
    const MODE = ${JSON.stringify(mode)};
    const KEY = "__shipshellVisualAnchorsV1";
    const ROOT_ID = "__shipshell-anchor-root";
    const STYLE_ID = "__shipshell-anchor-style";
    let state = window[KEY];

    const compactText = (value, max = 500) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, max);
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x), y: Math.round(rect.y),
        width: Math.round(rect.width), height: Math.round(rect.height),
      };
    };

    if (!state) {
      const root = document.createElement("div");
      root.id = ROOT_ID;
      root.setAttribute("aria-hidden", "true");
      Object.assign(root.style, {
        position: "fixed", inset: "0", zIndex: "2147483646",
        pointerEvents: "none", overflow: "hidden",
      });
      document.documentElement.appendChild(root);

      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        #${ROOT_ID} .ss-anchor { position: fixed; box-sizing: border-box; pointer-events: none; }
        #${ROOT_ID} .ss-anchor-label { position: absolute; left: -8px; top: -12px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: #07120d; color: #d7ffe9; border: 1px solid #7effbd; box-shadow: 0 0 14px rgba(126,255,189,.75); font: 700 11px/18px ui-monospace, SFMono-Regular, Menlo, monospace; text-align: center; }
        #${ROOT_ID} .ss-underline { border-bottom: 4px solid #7effbd; filter: drop-shadow(0 0 5px rgba(126,255,189,.9)); }
        #${ROOT_ID} .ss-circle { border: 3px solid #7edfff; border-radius: 999px; box-shadow: 0 0 16px rgba(126,223,255,.55), inset 0 0 12px rgba(126,223,255,.16); }
        #${ROOT_ID} .ss-glow { border: 2px solid #d987ff; border-radius: 10px; box-shadow: 0 0 8px rgba(217,135,255,.95), 0 0 28px rgba(217,135,255,.72), inset 0 0 18px rgba(217,135,255,.18); }
      `;
      document.documentElement.appendChild(style);

      const anchors = [];
      const elements = new Map();
      const exportAnchors = () => anchors.slice(-24).map((anchor) => {
        const element = elements.get(anchor.id);
        return { ...anchor, rect: element?.isConnected ? rectOf(element) : anchor.rect };
      });
      const render = () => {
        root.replaceChildren();
        anchors.forEach((anchor, index) => {
          const element = elements.get(anchor.id);
          if (!element?.isConnected) return;
          const rect = rectOf(element);
          anchor.rect = rect;
          if (rect.width <= 0 || rect.height <= 0) return;
          const mark = document.createElement("div");
          mark.className = `ss-anchor ss-${anchor.kind}`;
          Object.assign(mark.style, {
            left: `${Math.max(0, rect.x - (anchor.kind === "circle" ? 6 : 3))}px`,
            top: `${Math.max(0, rect.y - (anchor.kind === "circle" ? 6 : 3))}px`,
            width: `${Math.max(8, rect.width + (anchor.kind === "circle" ? 12 : 6))}px`,
            height: `${Math.max(anchor.kind === "underline" ? 6 : 8, rect.height + (anchor.kind === "circle" ? 12 : 6))}px`,
          });
          const label = document.createElement("span");
          label.className = "ss-anchor-label";
          label.textContent = String(index + 1);
          mark.appendChild(label);
          root.appendChild(mark);
        });
      };
      const clear = () => { anchors.splice(0); elements.clear(); render(); };
      const onClick = (event) => {
        if (!state || state.mode === "off") return;
        const target = event.target instanceof Element ? event.target.closest("button,a,input,select,textarea,[role],label,[tabindex],summary,[contenteditable=true],*" ) : null;
        if (!target || target.id === ROOT_ID || target.closest(`#${ROOT_ID}`)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const id = `anchor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const anchor = {
          id,
          kind: state.mode,
          text: compactText(target.innerText || target.textContent || target.getAttribute("value")),
          tag: target.tagName.toLowerCase().slice(0, 40),
          role: compactText(target.getAttribute("role"), 80),
          ariaLabel: compactText(target.getAttribute("aria-label"), 300),
          href: compactText(target instanceof HTMLAnchorElement ? target.href : "", 2000),
          rect: rectOf(target),
          createdAt: new Date().toISOString(),
        };
        anchors.push(anchor);
        if (anchors.length > 24) {
          const removed = anchors.shift();
          if (removed) elements.delete(removed.id);
        }
        elements.set(id, target);
        render();
      };
      const onKey = (event) => {
        if (event.key === "Escape" && state?.mode !== "off") {
          state.mode = "off";
          render();
        }
      };
      state = { mode: "off", anchors, elements, root, render, clear, exportAnchors, onClick, onKey };
      window[KEY] = state;
      window.addEventListener("click", onClick, true);
      window.addEventListener("scroll", render, true);
      window.addEventListener("resize", render, true);
      window.addEventListener("keydown", onKey, true);
    }

    state.mode = MODE;
    state.render();
    return { mode: state.mode, anchors: state.exportAnchors() };
  })()`;
}

async function applyAnnotationMode(contents, mode) {
  if (!contents || contents.isDestroyed()) return { mode: "off", anchors: [] };
  const nextMode = annotationModes.has(mode) ? mode : "off";
  return contents.executeJavaScript(annotationBootstrap(nextMode), true);
}

async function clearVisualAnchors(contents) {
  if (!contents || contents.isDestroyed()) return [];
  return contents.executeJavaScript(`(() => {
    const state = window.__shipshellVisualAnchorsV1;
    if (!state) return [];
    state.clear();
    return state.exportAnchors();
  })()`, true).catch(() => []);
}

async function readVisualAnchors(contents) {
  if (!contents || contents.isDestroyed()) return [];
  return contents.executeJavaScript(`(() => window.__shipshellVisualAnchorsV1?.exportAnchors?.() || [])()`, true).catch(() => []);
}

async function captureActivePageVisual(contents) {
  try {
    const image = await contents.capturePage(undefined, { stayHidden: true });
    const size = image.getSize();
    if (!size.width || !size.height) {
      return { available: false, imageDataUrl: "", error: "La pestaña no produjo un frame visible." };
    }

    const scale = Math.min(1, 1024 / size.width, 720 / size.height);
    let working = scale < 1
      ? image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) })
      : image;

    const targetBytes = 350_000;
    let jpeg = working.toJPEG(46);
    let attempts = 0;
    while (jpeg.length > targetBytes && attempts < 3) {
      const current = working.getSize();
      working = working.resize({
        width: Math.max(1, Math.round(current.width * 0.78)),
        height: Math.max(1, Math.round(current.height * 0.78)),
      });
      jpeg = working.toJPEG(Math.max(30, 42 - attempts * 4));
      attempts += 1;
    }

    if (jpeg.length > 450_000) {
      return { available: false, imageDataUrl: "", error: "El frame visual excedió el límite local de ShipShell." };
    }

    return {
      available: true,
      imageDataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    };
  } catch (error) {
    return {
      available: false,
      imageDataUrl: "",
      error: error instanceof Error ? error.message.slice(0, 500) : "No se pudo capturar el frame visual.",
    };
  }
}

async function readActivePageContext({ includeVisual = false } = {}) {
  const contents = activeContents();
  if (!contents || contents.isDestroyed()) {
    return { available: false, title: "", url: "", selection: "", text: "", anchors: [] };
  }

  const title = contents.getTitle() || "";
  const url = contents.getURL() || "";
  let semantic = { selection: "", text: "", error: undefined };

  try {
    const snapshot = await contents.executeJavaScript(`(() => {
      const selection = String(window.getSelection?.()?.toString?.() || "").trim().slice(0, 4000);
      const text = selection
        ? ""
        : String(document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 16000);
      return { selection, text };
    })()`, true);
    semantic = {
      selection: String(snapshot?.selection || ""),
      text: String(snapshot?.text || ""),
      error: undefined,
    };
  } catch (error) {
    semantic = {
      selection: "",
      text: "",
      error: error instanceof Error ? error.message.slice(0, 500) : "No se pudo leer el contenido visible.",
    };
  }

  const [anchors, visual] = await Promise.all([
    readVisualAnchors(contents),
    includeVisual ? captureActivePageVisual(contents) : Promise.resolve(undefined),
  ]);
  return {
    available: true,
    title: title.slice(0, 500),
    url: url.slice(0, 4000),
    selection: semantic.selection,
    text: semantic.text,
    error: semantic.error,
    anchors,
    visual,
  };
}

function registerIpc() {
  ipcMain.handle("browser:navigate", (_event, url) => {
    const contents = activeContents();
    if (!contents) return createTab(url);
    contents.loadURL(normalizeUrl(url));
    return true;
  });
  ipcMain.handle("browser:new-tab", (_event, url) => createTab(url));
  ipcMain.handle("browser:select-tab", (_event, id) => activateTab(id));
  ipcMain.handle("browser:close-tab", (_event, id) => closeTab(id));
  ipcMain.handle("browser:back", () => {
    const contents = activeContents();
    if (contents?.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
  });
  ipcMain.handle("browser:forward", () => {
    const contents = activeContents();
    if (contents?.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
  });
  ipcMain.handle("browser:reload", () => activeContents()?.reload());
  ipcMain.handle("browser:get-context", (_event, options) => readActivePageContext({ includeVisual: Boolean(options?.includeVisual) }));
  ipcMain.handle("browser:set-annotation-mode", async (_event, mode) => {
    annotationMode = annotationModes.has(mode) ? mode : "off";
    return applyAnnotationMode(activeContents(), annotationMode);
  });
  ipcMain.handle("browser:clear-annotations", () => clearVisualAnchors(activeContents()));
  ipcMain.handle("browser:get-annotations", () => readVisualAnchors(activeContents()));
  ipcMain.on("browser:set-bounds", (_event, nextBounds) => {
    const windowBounds = shellWindow?.getContentBounds();
    if (!windowBounds) return;
    browserBounds = {
      x: Math.max(0, Math.round(nextBounds.x)),
      y: Math.max(0, Math.round(nextBounds.y)),
      width: Math.max(320, Math.min(Math.round(nextBounds.width), windowBounds.width)),
      height: Math.max(180, Math.min(Math.round(nextBounds.height), windowBounds.height)),
    };
    if (activeTabId) tabs.get(activeTabId)?.view.setBounds(browserBounds);
  });
  ipcMain.on("browser:set-visible", (_event, visible) => {
    browserVisible = Boolean(visible);
    for (const tab of tabs.values()) {
      tab.view.setVisible(browserVisible && tab.id === activeTabId);
    }
  });
}

function configureSession() {
  const browserSession = session.fromPartition(partition);
  browserSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  const downloadDir = path.join(app.getPath("downloads"), "ShipShell");
  mkdirSync(downloadDir, { recursive: true });
  browserSession.on("will-download", (_event, item) => {
    item.setSavePath(path.join(downloadDir, path.basename(item.getFilename())));
  });
}

async function createWindow() {
  shellWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: "BlackMamba ShipShell",
    backgroundColor: "#050806",
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  shellWindow.on("closed", () => {
    for (const id of [...tabs.keys()]) closeTab(id);
    shellWindow = undefined;
  });
  shellWindow.on("resize", () => {
    if (activeTabId) tabs.get(activeTabId)?.view.setBounds(browserBounds);
  });
  const deckUrl = app.isPackaged ? "http://127.0.0.1:8787" : "http://127.0.0.1:5173";
  shellWindow.webContents.on("will-navigate", (event, destination) => {
    if (destination !== deckUrl && !destination.startsWith(`${deckUrl}/`)) event.preventDefault();
  });
  shellWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await shellWindow.loadURL(deckUrl);
}

app.whenReady().then(async () => {
  configureSession();
  registerIpc();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
