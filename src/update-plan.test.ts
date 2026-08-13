import { describe, expect, it } from "vitest";
import { getModuleContract } from "./modules";
import { planModuleUpdate } from "./update-plan";

describe("ShipShell update planner", () => {
  it("hot-swaps a compatible module revision", () => {
    const current = getModuleContract("copilot");
    const plan = planModuleUpdate(current, { ...current, revision: "2026.08.13-2" });
    expect(plan.mode).toBe("hot");
    expect(plan.preservesSession).toBe(true);
  });

  it("uses a safe handoff when a module contract changes", () => {
    const current = getModuleContract("terminal");
    const plan = planModuleUpdate(current, {
      ...current,
      version: 1,
      revision: "2026.08.13-3",
      provides: [...current.provides, "mission.answer"],
    });
    expect(plan.mode).toBe("safe-handoff");
    expect(plan.preservesSession).toBe(true);
  });

  it("rejects swapping a different module into the slot", () => {
    const current = getModuleContract("browser");
    const other = getModuleContract("terminal");
    const plan = planModuleUpdate(current, { ...other, revision: "x" });
    expect(plan.mode).toBe("reject");
  });
});
