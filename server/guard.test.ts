import { describe, expect, it } from "vitest";
import { resolveTerminalDirectory, reviewCommand } from "./guard";

describe("reviewCommand", () => {
  it("permits known read commands without a seal", () => {
    expect(reviewCommand("git status")).toMatchObject({ allowed: true, requiresSeal: false, risk: "read" });
    expect(reviewCommand("ls -la")).toMatchObject({ allowed: true, requiresSeal: false, risk: "read" });
    expect(reviewCommand("cat README.md")).toMatchObject({ allowed: true, requiresSeal: false, risk: "read" });
  });

  it("keeps session builtins live without filesystem mutation", () => {
    expect(reviewCommand("cd src")).toMatchObject({ allowed: true, requiresSeal: false, risk: "session", builtin: "cd" });
    expect(reviewCommand("clear")).toMatchObject({ allowed: true, requiresSeal: false, risk: "session", builtin: "clear" });
  });

  it("permits local mutations only behind ShipSeal", () => {
    expect(reviewCommand("git add src/App.tsx")).toMatchObject({ allowed: true, requiresSeal: true, risk: "write" });
    expect(reviewCommand("mkdir scratch")).toMatchObject({ allowed: true, requiresSeal: true, risk: "write" });
    expect(reviewCommand("npm run build")).toMatchObject({ allowed: true, requiresSeal: true, risk: "write" });
  });

  it("marks remote or network-capable maneuvers as external", () => {
    expect(reviewCommand("git push origin main")).toMatchObject({ allowed: true, requiresSeal: true, risk: "external" });
    expect(reviewCommand("npm install react")).toMatchObject({ allowed: true, requiresSeal: true, risk: "external" });
    expect(reviewCommand("npx vite --version")).toMatchObject({ allowed: true, requiresSeal: true, risk: "external" });
  });

  it("blocks shell escapes and privileged executables", () => {
    expect(reviewCommand("ls; rm -rf .")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("sudo rm notes.txt")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("bash -c echo-hi")).toMatchObject({ allowed: false, risk: "blocked" });
  });

  it("keeps file operations inside the workspace", () => {
    expect(reviewCommand("ls /Users").allowed).toBe(false);
    expect(reviewCommand("rm ../../notes.txt").allowed).toBe(false);
    expect(reviewCommand("touch src/new-file.ts")).toMatchObject({ allowed: true, requiresSeal: true });
  });
});

describe("resolveTerminalDirectory", () => {
  it("allows navigation inside the workspace and blocks escaping it", () => {
    const workspace = "/workspace/project";
    expect(resolveTerminalDirectory(workspace, workspace, "src")).toBe("/workspace/project/src");
    expect(resolveTerminalDirectory(workspace, "/workspace/project/src", "..")).toBe(workspace);
    expect(resolveTerminalDirectory(workspace, workspace, "../outside")).toBeNull();
  });
});
