import { describe, expect, it } from "vitest";
import { publishTerminalContext, readTerminalContext, redactTerminalContextText } from "./semantic-context";

describe("terminal semantic-context redaction", () => {
  it("redacts common secret formats before they can enter Copilot context", () => {
    const raw = [
      "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456",
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz.1234567890",
      "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456",
      "registry=https://user:supersecret@example.test/pkg",
      "remote=https://ghp_abcdefghijklmnopqrstuvwxyz123456@example.test/repo",
      "jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
      "AKIAABCDEFGHIJKLMNOP",
    ].join("\n");

    const redacted = redactTerminalContextText(raw)!;
    expect(redacted).not.toContain("sk-proj-");
    expect(redacted).not.toContain("ghp_");
    expect(redacted).not.toContain("supersecret");
    expect(redacted).not.toContain("eyJhbGci");
    expect(redacted).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(redacted).toContain("[REDACTED]");
  });

  it("redacts both the last command and output tail after explicit sharing", () => {
    publishTerminalContext({
      cwd: "./src",
      running: false,
      outputShared: true,
      lastCommand: "echo API_KEY=supersecretvalue",
      outputTail: "build ok\nBearer abcdefghijklmnopqrstuvwxyz123456\n",
    });

    expect(readTerminalContext()).toEqual({
      cwd: "./src",
      running: false,
      outputShared: true,
      lastCommand: "echo API_KEY=[REDACTED]",
      outputTail: "build ok\nBearer [REDACTED]\n",
    });
  });

  it("withholds terminal command and output text by default even if the caller supplies it", () => {
    publishTerminalContext({
      cwd: ".",
      running: false,
      outputShared: false,
      lastCommand: "cat private.txt",
      outputTail: "arbitrary confidential text that does not match a secret pattern",
    });

    expect(readTerminalContext()).toEqual({
      cwd: ".",
      running: false,
      outputShared: false,
      lastCommand: undefined,
      outputTail: undefined,
    });
  });

  it("removes private-key blocks from model-facing terminal context", () => {
    const value = [
      "before",
      "-----BEGIN PRIVATE KEY-----",
      "abcdefghijklmnopqrstuvwxyz",
      "-----END PRIVATE KEY-----",
      "after",
    ].join("\n");

    expect(redactTerminalContextText(value)).toBe("before\n[REDACTED PRIVATE KEY]\nafter");
  });
});
