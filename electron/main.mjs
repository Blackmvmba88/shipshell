import { app, BrowserWindow, WebContentsView, ipcMain, session } from "electron";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { annotationBootstrap, annotationModes } from "./visual-anchors.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const preload = path.join(here, "preload.cjs");
const partition = "persist:shipshell";

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

function activeTab() {
  return activeTabId ? tabs.get(activeTabId) : undefined;
}

function activeContents() {
  return activeTab()?.view.webContents;
}

async function applyAnnotationMode(contents, mode) {
  if (!contents || contents.isDestroyed()) return { mode: "off", anchors: [] };
  const nextMode = annotationModes.has(mode) ? mode : "off";
  return contents.executeJavaScript(annotationBootstrap(nextMode), true);
}

async function readVisualAnchors(contents) {
  if (!contents || contents.isDestroyed()) return [];
  return contents.executeJavaScript(
    `(() => window.__shipshellVisualAnchorsV2?.exportAnchors?.() || [])()`,
    true,
  ).catch(() => []);
}

async function snapshotTabAnchors(tab) {
  if (!tab?.view?.webContents || tab.view.webContents.isDestroyed()) return [];
  const snapshotUrl = tab.url;
  const anchors = await readVisualAnchors(tab.view.webContents);
  if (anchors.length) tab.anchorSnapshots.set(snapshotUrl, anchors);
  else tab.anchorSnapshots.delete(snapshotUrl);
  return anchors;
}

async function restoreTabAnchors(tab) {
  if (!tab?.view?.webContents || tab.view.webContents.isDestroyed()) return [];
  await applyAnnotationMode(tab.view.webContents, annotationMode);
  const saved = tab.anchorSnapshots.get(tab.url);
  if (!saved?.length) return [];
  return tab.view.webContents.executeJavaScript(`(() => {
    const state = window.__shipshellVisualAnchorsV2;
    return state?.restore?.(${JSON.stringify(saved)}) || [];
  })()`, true).catch(() => []);
}

async function clearVisualAnchors(tab) {
  if (!tab?.view?.webContents || tab.view.webContents.isDestroyed()) return [];
  const anchors = await tab.view.webContents.executeJavaScript(`(() => {
    const state = window.__shipshellVisualAnchorsV2;
    if (!state) return [];
    state.clear();
    return state.exportAnchors();
  })()`, true).catch(() => []);
  tab.anchorSnapshots.delete(tab.url);
  return anchors;
}

async function setVisualAnchorNote(tab, number, note) {
  if (!tab?.view?.webContents || tab.view.webContents.isDestroyed()) return [];
  const safeNumber = Number(number);
  const safeNote = String(note || "").slice(0, 500);
  const anchors = await tab.view.webContents.executeJavaScript(`(() => {
    const state = window.__shipshellVisualAnchorsV2;
    return state?.setNote?.(${JSON.stringify(safeNumber)}, ${JSON.stringify(safeNote)}) || [];
  })()`, true).catch(() => []);
  if (anchors.length) tab.anchorSnapshots.set(tab.url, anchors);
  return anchors;
}

async function focusVisualAnchors(tab, numbers) {
  if (!tab?.view?.webContents || tab.view.webContents.isDestroyed()) return { focused: [], anchors: [] };
  const safeNumbers = Array.isArray(numbers)
    ? numbers.map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 24).slice(0, 24)
    : [];
  return tab.view.webContents.executeJavaScript(`(() => {
    const state = window.__shipshellVisualAnchorsV2;
    return state?.focus?.(${JSON.stringify(safeNumbers)}) || { focused: [], anchors: [] };
  })()`, true).catch(() => ({ focused: [], anchors: [] }));
}

function activateTab(id) {
  if (!tabs.has(id)) return;
  activeTabId = id;
  for (const tab of tabs.values()) {
    tab.view.setVisible(browserVisible && tab.id === id);
    if (tab.id === id) tab.view.setBounds(browserBounds);
  }
  restoreTabAnchors(tabs.get(id)).catch(() => undefined);
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
  const tab = { id, view, url, title: "Cargando…", loading: true, anchorSnapshots: new Map() };
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
    if (tab.id === activeTabId) restoreTabAnchors(tab).catch(() => undefined);
  });
  view.webContents.on("page-title-updated", (_event, title) => { tab.title = title; publishState(); });
  view.webContents.on("did-navigate", sync);
  view.webContents.on("did-navigate-in-page", sync);
  view.webContents.on("will-navigate", (event, destination) => {
    if (!isWebUrl(destination)) {
      event.preventDefault();
      return;
    }
    snapshotTabAnchors(tab).catch(() => undefined);
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

async function captureActivePageVisual(contents) {
  try {
    const image = await contents.capturePage();
    const size = image.getSize();
    if (!size.width || !size.height) {
      return { available: false, imageDataUrl: "", error: "La pestaña no produjo un frame visible." };
    }

    const scale = Math.min(1, 1024 / size.width, 720 / size.height);
    let working = scale < 1
      ? image.resize({
          width: Math.max(1, Math.round(size.width * scale)),
          height: Math.max(1, Math.round(size.height * scale)),
        })
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
  const tab = activeTab();
  const contents = tab?.view.webContents;
  if (!tab || !contents || contents.isDestroyed()) {
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
  if (anchors.length) tab.anchorSnapshots.set(tab.url, anchors);

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
  ipcMain.handle("browser:navigate", async (_event, url) => {
    const tab = activeTab();
    if (!tab) return createTab(url);
    await snapshotTabAnchors(tab);
    tab.view.webContents.loadURL(normalizeUrl(url));
    return true;
  });
  ipcMain.handle("browser:new-tab", (_event, url) => createTab(url));
  ipcMain.handle("browser:select-tab", (_event, id) => activateTab(id));
  ipcMain.handle("browser:close-tab", (_event, id) => closeTab(id));
  ipcMain.handle("browser:back", async () => {
    const tab = activeTab();
    const contents = tab?.view.webContents;
    if (tab && contents?.navigationHistory.canGoBack()) {
      await snapshotTabAnchors(tab);
      contents.navigationHistory.goBack();
    }
  });
  ipcMain.handle("browser:forward", async () => {
    const tab = activeTab();
    const contents = tab?.view.webContents;
    if (tab && contents?.navigationHistory.canGoForward()) {
      await snapshotTabAnchors(tab);
      contents.navigationHistory.goForward();
    }
  });
  ipcMain.handle("browser:reload", async () => {
    const tab = activeTab();
    if (!tab) return;
    await snapshotTabAnchors(tab);
    tab.view.webContents.reload();
  });
  ipcMain.handle("browser:get-context", (_event, options) =>
    readActivePageContext({ includeVisual: Boolean(options?.includeVisual) }),
  );
  ipcMain.handle("browser:set-annotation-mode", async (_event, mode) => {
    annotationMode = annotationModes.has(mode) ? mode : "off";
    return applyAnnotationMode(activeContents(), annotationMode);
  });
  ipcMain.handle("browser:clear-annotations", () => clearVisualAnchors(activeTab()));
  ipcMain.handle("browser:get-annotations", () => snapshotTabAnchors(activeTab()));
  ipcMain.handle("browser:set-annotation-note", (_event, number, note) =>
    setVisualAnchorNote(activeTab(), number, note),
  );
  ipcMain.handle("browser:focus-annotations", (_event, numbers) =>
    focusVisualAnchors(activeTab(), numbers),
  );
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
