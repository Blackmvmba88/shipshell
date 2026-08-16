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
    expect(reviewCommand("git commit -m safe")).toMatchObject({ allowed: true, requiresSeal: true, risk: "write" });
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

  it("blocks read-tool options that can load external files or preprocessors", () => {
    expect(reviewCommand("grep --file=/etc/passwd needle .")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("grep -f patterns.txt needle .")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("rg --pre cat needle .")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("rg --ignore-file=../outside.ignore needle .")).toMatchObject({ allowed: false, risk: "blocked" });
  });

  it("blocks Git configuration and unregistered capability expansion", () => {
    expect(reviewCommand("git -c alias.x=!sh x")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("git config alias.shipshell !sh")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("git worktree add ../outside")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("git maintenance run")).toMatchObject({ allowed: false, risk: "blocked" });
  });

  it("keeps Git network commands sealed while blocking filesystem escapes", () => {
    expect(reviewCommand("git clone https://example.com/repo.git vendor/repo")).toMatchObject({ allowed: true, requiresSeal: true, risk: "external" });
    expect(reviewCommand("git clone https://example.com/repo.git ../outside")).toMatchObject({ allowed: false, risk: "blocked" });
    expect(reviewCommand("git diff -- ../outside")).toMatchObject({ allowed: false, risk: "blocked" });
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
