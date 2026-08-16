import { describe, expect, it } from "vitest";
import { publishTerminalContext, readTerminalContext } from "./semantic-context";

describe("terminal semantic context", () => {
  it("redacts command and output text after explicit sharing", () => {
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
});
