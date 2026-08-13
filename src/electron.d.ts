interface ShipShellTab {
  id: string;
  title: string;
  url: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface ShipShellBrowserState {
  activeTabId: string | null;
  tabs: ShipShellTab[];
}

type ShipShellAnnotationMode = "off" | "underline" | "circle" | "glow";

interface ShipShellVisualAnchor {
  id: string;
  kind: Exclude<ShipShellAnnotationMode, "off">;
  text: string;
  tag: string;
  role: string;
  ariaLabel: string;
  href: string;
  rect: { x: number; y: number; width: number; height: number };
  createdAt: string;
}

interface ShipShellVisualContext {
  available: boolean;
  imageDataUrl: string;
  error?: string;
}

interface ShipShellPageContext {
  available: boolean;
  title: string;
  url: string;
  selection: string;
  text: string;
  error?: string;
  anchors?: ShipShellVisualAnchor[];
  visual?: ShipShellVisualContext;
}

interface Window {
  shipShellBrowser?: {
    isNative: true;
    navigate(url: string): Promise<unknown>;
    newTab(url?: string): Promise<unknown>;
    selectTab(id: string): Promise<unknown>;
    closeTab(id: string): Promise<unknown>;
    back(): Promise<unknown>;
    forward(): Promise<unknown>;
    reload(): Promise<unknown>;
    getPageContext(): Promise<ShipShellPageContext>;
    setAnnotationMode(mode: ShipShellAnnotationMode): Promise<{ mode: ShipShellAnnotationMode; anchors: ShipShellVisualAnchor[] }>;
    clearAnnotations(): Promise<ShipShellVisualAnchor[]>;
    getAnnotations(): Promise<ShipShellVisualAnchor[]>;
    setBounds(bounds: { x: number; y: number; width: number; height: number }): void;
    setVisible(visible: boolean): void;
    onState(listener: (state: ShipShellBrowserState) => void): () => void;
  };
}
