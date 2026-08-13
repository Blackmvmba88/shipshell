import { describe, expect, it } from "vitest";
import { buildCopilotProfileInstruction, copilotProfileSchema } from "./copilot-profile";

describe("copilot profile", () => {
  it("accepts a valid universe profile", () => {
    const result = copilotProfileSchema.parse({ universeId: "studio-neon", workMode: "studio", voice: "creative" });
    expect(result.voice).toBe("creative");
  });

  it("rejects unknown work modes", () => {
    expect(() => copilotProfileSchema.parse({ universeId: "x", workMode: "chaos", voice: "creative" })).toThrow();
  });

  it("turns voice and mode into behavioral guidance without weakening ShipSeal", () => {
    const instruction = buildCopilotProfileInstruction({ universeId: "build-obsidian", workMode: "build", voice: "technical" });
    expect(instruction).toContain("preciso, técnico");
    expect(instruction).toContain("implementación");
    expect(instruction).toContain("nunca cambia las reglas de seguridad");
    expect(instruction).toContain("ShipSeal");
  });
});
