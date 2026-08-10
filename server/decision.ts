import type { MissionDecision } from "./types.js";

const URL_PATTERN = /^(https?:\/\/|localhost(?::\d+)?(?:\/|$))/i;

export function decideMission(rawInput: string): MissionDecision {
  const input = rawInput.trim();
  if (URL_PATTERN.test(input)) {
    return {
      kind: "navigate",
      normalizedInput: input.startsWith("http") ? input : `http://${input}`,
      requiresNetwork: true,
      requiresSeal: false,
    };
  }

  const needsFreshWeb = /\b(busca|buscar|investiga|investigar|hoy|actual(?:es)?|últim[oa]s?|noticias|precio|tendencias|search|latest|today|news)\b/i.test(input);

  return {
    kind: needsFreshWeb ? "search" : "ask",
    normalizedInput: input,
    requiresNetwork: true,
    requiresSeal: false,
  };
}
