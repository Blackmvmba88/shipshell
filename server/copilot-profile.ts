import { z } from "zod";

export const shipModuleSchema = z.enum(["browser", "ports", "copilot", "terminal", "logbook"]);

export const copilotProfileSchema = z.object({
  universeId: z.string().trim().min(1).max(80),
  workMode: z.enum(["focus", "research", "build", "studio", "command", "casual"]),
  voice: z.enum(["quiet", "technical", "creative", "explorer", "executive", "conversational"]),
  activeModule: shipModuleSchema.optional(),
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

const moduleInstructions: Record<NonNullable<CopilotProfile["activeModule"]>, string> = {
  browser: "El usuario está trabajando principalmente con la página o navegación activa. Prioriza lo visible en esa experiencia.",
  ports: "El usuario está trabajando con accesos, servicios o herramientas conectadas. Prioriza integración y flujo entre herramientas.",
  copilot: "El usuario está trabajando directamente contigo. Prioriza claridad conversacional, contexto y próximos movimientos útiles.",
  terminal: "El usuario está trabajando en terminal. Prioriza comandos exactos, estado del proyecto, debugging y verificaciones reproducibles.",
  logbook: "El usuario está revisando evidencia y actividad. Prioriza trazabilidad, cambios, resultados, bloqueos y discrepancias.",
};

export function buildCopilotProfileInstruction(profile?: CopilotProfile): string {
  if (!profile) return "";
  return [
    `Universo activo: ${profile.universeId}.`,
    `Modo de trabajo: ${profile.workMode}. ${workModeInstructions[profile.workMode]}`,
    `Voz del copiloto: ${profile.voice}. ${voiceInstructions[profile.voice]}`,
    profile.activeModule ? `Módulo activo: ${profile.activeModule}. ${moduleInstructions[profile.activeModule]}` : "",
    "El módulo activo orienta la atención, pero no concede permisos adicionales ni implica que una acción ya ocurrió.",
    "La voz cambia presentación y énfasis, pero nunca cambia las reglas de seguridad, permisos, hechos ni límites de ShipSeal.",
  ].filter(Boolean).join(" ");
}
