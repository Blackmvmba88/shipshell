export type WorkMode = "focus" | "research" | "build" | "studio" | "command" | "casual";
export type VisualTheme = "minimal" | "obsidian" | "neon" | "sunset" | "command" | "glass";
export type CopilotVoice = "quiet" | "technical" | "creative" | "explorer" | "executive" | "conversational";
export type Density = "compact" | "balanced" | "cinematic";
export type ShaderProfile = "none" | "signal" | "horizon" | "neon-fog" | "grid" | "glass-bloom";

export interface Universe {
  id: string;
  name: string;
  description: string;
  workMode: WorkMode;
  theme: VisualTheme;
  voice: CopilotVoice;
  density: Density;
  shader: ShaderProfile;
}

export const UNIVERSES: Universe[] = [
  {
    id: "focus-minimal",
    name: "Focus Minimal",
    description: "Navegador al frente, casi cero ruido y copiloto discreto.",
    workMode: "focus",
    theme: "minimal",
    voice: "quiet",
    density: "compact",
    shader: "none",
  },
  {
    id: "research-sunset",
    name: "Research Sunset",
    description: "Más espacio para contexto, lectura y comparación con una atmósfera cálida.",
    workMode: "research",
    theme: "sunset",
    voice: "explorer",
    density: "balanced",
    shader: "horizon",
  },
  {
    id: "build-obsidian",
    name: "Build Obsidian",
    description: "Terminal prioritaria, contraste sobrio y copiloto técnico.",
    workMode: "build",
    theme: "obsidian",
    voice: "technical",
    density: "compact",
    shader: "signal",
  },
  {
    id: "studio-neon",
    name: "Studio Neon Mamba",
    description: "Puertos creativos visibles, copiloto expresivo y energía nocturna.",
    workMode: "studio",
    theme: "neon",
    voice: "creative",
    density: "balanced",
    shader: "neon-fog",
  },
  {
    id: "command-deck",
    name: "Command Deck",
    description: "Todo a la vista: navegación, copiloto, terminal, evidencia y telemetría.",
    workMode: "command",
    theme: "command",
    voice: "executive",
    density: "compact",
    shader: "grid",
  },
  {
    id: "casual-glass",
    name: "Casual Glass",
    description: "Ligero, espacioso y conversacional para navegar sin sentir una cabina técnica.",
    workMode: "casual",
    theme: "glass",
    voice: "conversational",
    density: "cinematic",
    shader: "glass-bloom",
  },
];

export const DEFAULT_UNIVERSE_ID = "research-sunset";

export function getUniverse(id: string | null | undefined): Universe {
  return UNIVERSES.find((universe) => universe.id === id) ?? UNIVERSES.find((universe) => universe.id === DEFAULT_UNIVERSE_ID)!;
}

export function applyUniverse(universe: Universe): void {
  const root = document.documentElement;
  root.dataset.universe = universe.id;
  root.dataset.workMode = universe.workMode;
  root.dataset.theme = universe.theme;
  root.dataset.voice = universe.voice;
  root.dataset.density = universe.density;
  root.dataset.shader = universe.shader;
  window.localStorage.setItem("shipshell.universe", universe.id);
}

export function readStoredUniverse(): Universe {
  try {
    return getUniverse(window.localStorage.getItem("shipshell.universe"));
  } catch {
    return getUniverse(DEFAULT_UNIVERSE_ID);
  }
}
