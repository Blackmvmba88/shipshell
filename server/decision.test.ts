import { describe, expect, it } from "vitest";
import { decideMission } from "./decision";

describe("decideMission", () => {
  it("routes URLs to navigation", () => {
    expect(decideMission("https://example.com")).toMatchObject({ kind: "navigate", normalizedInput: "https://example.com" });
  });

  it("routes ordinary prompts to the crew without paying for web search", () => {
    expect(decideMission("¿Cómo funcionó mi campaña?").kind).toBe("ask");
    expect(decideMission("Resume este concepto en una frase").kind).toBe("ask");
  });

  it("routes fresh discovery prompts to Radar search", () => {
    expect(decideMission("busca las mejores tendencias musicales de hoy").kind).toBe("search");
  });
});
