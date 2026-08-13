import { describe, expect, it } from "vitest";
import { DEFAULT_UNIVERSE_ID, getUniverse, UNIVERSES } from "./universes";

describe("ShipShell universes", () => {
  it("ships one functional preset per core work mode", () => {
    const modes = new Set(UNIVERSES.map((universe) => universe.workMode));
    expect(modes).toEqual(new Set(["focus", "research", "build", "studio", "command", "casual"]));
  });

  it("keeps universe ids unique", () => {
    const ids = UNIVERSES.map((universe) => universe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defines the complete behavior dimensions for every preset", () => {
    for (const universe of UNIVERSES) {
      expect(universe.name).toBeTruthy();
      expect(universe.description).toBeTruthy();
      expect(universe.theme).toBeTruthy();
      expect(universe.voice).toBeTruthy();
      expect(universe.density).toBeTruthy();
      expect(universe.shader).toBeTruthy();
    }
  });

  it("falls back to the canonical default universe", () => {
    expect(getUniverse("does-not-exist").id).toBe(DEFAULT_UNIVERSE_ID);
  });
});
