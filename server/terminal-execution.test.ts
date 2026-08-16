import path from "node:path";
import { describe, expect, it } from "vitest";
import { reviewCommand } from "./guard";
import { buildExecutablePath, buildTerminalEnvironment, buildTerminalExecutionArgs } from "./terminal-execution";

describe("buildTerminalEnvironment", () => {
  it("removes secrets, process-injection variables, and workspace PATH entries", () => {
    const workspace = path.resolve("/workspace/project");
    const rawPath = [
      path.join(workspace, "node_modules", ".bin"),
      ".",
      "/usr/local/bin",
      "/usr/bin",
    ].join(path.delimiter);
    const env = buildTerminalEnvironment({
      PATH: rawPath,
      HOME: "/home/user",
      LANG: "en_US.UTF-8",
      OPENAI_API_KEY: "secret",
      GITHUB_TOKEN: "token",
      INTERNAL_PASSWORD: "password",
      NPM_CONFIG_REGISTRY_AUTHTOKEN: "npm-secret",
      NODE_OPTIONS: "--require ./inject.js",
      PYTHONPATH: "/tmp/inject",
      LD_PRELOAD: "/tmp/inject.so",
      GIT_CONFIG_COUNT: "1",
      GIT_SSH_COMMAND: "sh -c evil",
      GIT_ALLOW_PROTOCOL: "ext:file:https",
      GIT_PROTOCOL_FROM_USER: "1",
      RIPGREP_CONFIG_PATH: "/tmp/rg-config",
      SSH_AUTH_SOCK: "/tmp/ssh-agent.sock",
    }, workspace);

    expect(env).toMatchObject({
      PATH: ["/usr/local/bin", "/usr/bin"].join(path.delimiter),
      HOME: "/home/user",
      LANG: "en_US.UTF-8",
      SSH_AUTH_SOCK: "/tmp/ssh-agent.sock",
      GIT_TERMINAL_PROMPT: "0",
      GIT_ALLOW_PROTOCOL: "https:http:ssh:git",
      GIT_PROTOCOL_FROM_USER: "0",
    });
    for (const key of ["OPENAI_API_KEY", "GITHUB_TOKEN", "INTERNAL_PASSWORD", "NPM_CONFIG_REGISTRY_AUTHTOKEN", "NODE_OPTIONS", "PYTHONPATH", "LD_PRELOAD", "GIT_CONFIG_COUNT", "GIT_SSH_COMMAND", "RIPGREP_CONFIG_PATH"]) {
      expect(env[key]).toBeUndefined();
    }
  });

  it("deduplicates absolute executable paths and drops relative entries", () => {
    const workspace = path.resolve("/workspace/project");
    const rawPath = ["", ".", "bin", "/usr/bin", "/usr/bin", path.join(workspace, "tools")].join(path.delimiter);
    expect(buildExecutablePath(rawPath, workspace)).toBe("/usr/bin");
  });
});

describe("buildTerminalExecutionArgs", () => {
  const safeHooksPath = "/workspace/.shipshell/empty-hooks";

  it("disables hooks and fsmonitor for every Git command", () => {
    const args = buildTerminalExecutionArgs(reviewCommand("git status"), safeHooksPath);
    expect(args).toEqual([
      "-c", `core.hooksPath=${safeHooksPath}`,
      "-c", "core.fsmonitor=false",
      "status",
    ]);
  });

  it("disables external diff and textconv helpers for Git read views", () => {
    for (const command of ["git diff", "git log -1", "git show HEAD"]) {
      const args = buildTerminalExecutionArgs(reviewCommand(command), safeHooksPath);
      expect(args).toContain("--no-ext-diff");
      expect(args).toContain("--no-textconv");
    }
  });

  it("scopes unsealed Git config reads to repository-local configuration", () => {
    const args = buildTerminalExecutionArgs(reviewCommand("git config --list"), safeHooksPath);
    const configIndex = args.indexOf("config");
    expect(configIndex).toBeGreaterThan(-1);
    expect(args.slice(configIndex + 1)).toEqual(["--local", "--list"]);
  });

  it("forces ripgrep to ignore ambient configuration files", () => {
    expect(buildTerminalExecutionArgs(reviewCommand("rg ShipSeal src"), safeHooksPath)).toEqual([
      "--no-config",
      "ShipSeal",
      "src",
    ]);
  });

  it("leaves other non-Git command arguments unchanged", () => {
    const decision = reviewCommand("touch proof.txt");
    expect(buildTerminalExecutionArgs(decision, safeHooksPath)).toEqual(["proof.txt"]);
  });
});
