import { describe, expect, it } from "vitest";
import { canConnectModules, getModuleContract, moduleByShortcut, SHIP_MODULES } from "./modules";

describe("ShipShell module contracts", () => {
  it("keeps stable unique ids and shortcuts", () => {
    expect(new Set(SHIP_MODULES.map((module) => module.id)).size).toBe(SHIP_MODULES.length);
    expect(new Set(SHIP_MODULES.map((module) => module.shortcut)).size).toBe(SHIP_MODULES.length);
    expect(moduleByShortcut("4")).toBe("terminal");
  });

  it("versions every module contract", () => {
    for (const module of SHIP_MODULES) {
      expect(module.version).toBe(1);
      expect(module.capabilities.length).toBeGreaterThan(0);
      expect(module.provides.length).toBeGreaterThan(0);
    }
  });

  it("connects modules through declared signals like puzzle pieces", () => {
    expect(canConnectModules("browser", "copilot")).toBe(true);
    expect(canConnectModules("terminal", "copilot")).toBe(true);
    expect(canConnectModules("copilot", "terminal")).toBe(false);
    expect(canConnectModules("terminal", "logbook")).toBe(true);
  });

  it("exposes explicit terminal execution capabilities", () => {
    const terminal = getModuleContract("terminal");
    expect(terminal.capabilities).toContain("execute");
    expect(terminal.provides).toContain("terminal.output");
  });
});
