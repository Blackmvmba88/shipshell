import { z } from "zod";

export const copilotProfileSchema = z.object({
  universeId: z.string().trim().min(1).max(80),
  workMode: z.enum(["focus", "research", "build", "studio", "command", "casual"]),
  voice: z.enum(["quiet", "technical", "creative", "explorer", "executive", "conversational"]),
});

export type CopilotProfile = z.infer<typeof copilotProfileSchema>;

const voiceInstructions: Record<CopilotProfile["voice"], string> = {
  quiet: "Sé breve, calmado y poco intrusivo. Prioriza respuestas compactas y sólo amplía cuando haga falta.",
  technical: "Sé preciso, técnico y verificable. Prioriza arquitectura, causas, tradeoffs, comandos o pasos concretos cuando sean pertinentes.",
  creative: "Sé imaginativo y expresivo sin perder precisión. Busca alternativas, conexiones inesperadas y lenguaje visual cuando ayude.",
  explorer: "Sé curioso y analítico. Expón patrones, preguntas útiles, incertidumbres y rutas de investigación sin abrumar.",
  executive: "Sé directo y orientado a decisión. Prioriza estado, impacto, riesgo, opciones y siguiente movimiento.",
  conversational: "Sé natural, cercano y claro. Mantén el flujo ligero y evita jerga innecesaria salvo que el usuario la use.",
};

const workModeInstructions: Record<CopilotProfile["workMode"], string> = {
  focus: "Protege la concentración: evita ramificaciones innecesarias y reduce el ruido visual o conceptual.",
  research: "Prioriza contexto, comparación, fuentes, supuestos y separación entre hechos e inferencias.",
  build: "Prioriza implementación, debugging, validación, cambios reversibles y evidencia técnica.",
  studio: "Prioriza flujo creativo, producción, iteración rápida, variantes útiles y continuidad artística.",
  command: "Prioriza visión operativa completa: estado, bloqueos, evidencia, dependencias y próximos movimientos.",
  casual: "Prioriza facilidad, claridad y acompañamiento sin convertir cada pregunta en un procedimiento pesado.",
};

export function buildCopilotProfileInstruction(profile?: CopilotProfile): string {
  if (!profile) return "";
  return [
    `Universo activo: ${profile.universeId}.`,
    `Modo de trabajo: ${profile.workMode}. ${workModeInstructions[profile.workMode]}`,
    `Voz del copiloto: ${profile.voice}. ${voiceInstructions[profile.voice]}`,
    "La voz cambia presentación y énfasis, pero nunca cambia las reglas de seguridad, permisos, hechos ni límites de ShipSeal.",
  ].join(" ");
}
