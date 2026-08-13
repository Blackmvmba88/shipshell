import { describe, expect, it } from "vitest";
import { buildCopilotProfileInstruction, copilotProfileSchema } from "./copilot-profile";

describe("copilot profile", () => {
  it("accepts a valid universe profile with an active work module", () => {
    const result = copilotProfileSchema.parse({ universeId: "studio-neon", workMode: "studio", voice: "creative", activeModule: "terminal" });
    expect(result.voice).toBe("creative");
    expect(result.activeModule).toBe("terminal");
  });

  it("rejects unknown work modes and modules", () => {
    expect(() => copilotProfileSchema.parse({ universeId: "x", workMode: "chaos", voice: "creative" })).toThrow();
    expect(() => copilotProfileSchema.parse({ universeId: "x", workMode: "build", voice: "technical", activeModule: "reactor" })).toThrow();
  });

  it("turns voice, mode, and module into behavioral guidance without weakening ShipSeal", () => {
    const instruction = buildCopilotProfileInstruction({ universeId: "build-obsidian", workMode: "build", voice: "technical", activeModule: "terminal" });
    expect(instruction).toContain("preciso, técnico");
    expect(instruction).toContain("implementación");
    expect(instruction).toContain("Módulo activo: terminal");
    expect(instruction).toContain("comandos exactos");
    expect(instruction).toContain("no concede permisos adicionales");
    expect(instruction).toContain("nunca cambia las reglas de seguridad");
    expect(instruction).toContain("ShipSeal");
  });
});
