const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shipShellBrowser", {
  isNative: true,
  navigate: (url) => ipcRenderer.invoke("browser:navigate", url),
  newTab: (url) => ipcRenderer.invoke("browser:new-tab", url),
  selectTab: (id) => ipcRenderer.invoke("browser:select-tab", id),
  closeTab: (id) => ipcRenderer.invoke("browser:close-tab", id),
  back: () => ipcRenderer.invoke("browser:back"),
  forward: () => ipcRenderer.invoke("browser:forward"),
  reload: () => ipcRenderer.invoke("browser:reload"),
  setBounds: (bounds) => ipcRenderer.send("browser:set-bounds", bounds),
  setVisible: (visible) => ipcRenderer.send("browser:set-visible", visible),
  onState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("browser:state", handler);
    return () => ipcRenderer.removeListener("browser:state", handler);
  },
});
