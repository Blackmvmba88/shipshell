import { describe, expect, it } from "vitest";
import { reviewCommand } from "./guard";

describe("reviewCommand", () => {
  it("permits known read-only commands", () => {
    expect(reviewCommand("git status").allowed).toBe(true);
    expect(reviewCommand("ls -la").allowed).toBe(true);
  });

  it("blocks shell operators", () => {
    expect(reviewCommand("ls; rm -rf ./build")).toMatchObject({ allowed: false, requiresSeal: true });
  });

  it("blocks mutations by default", () => {
    expect(reviewCommand("git push")).toMatchObject({ allowed: false, requiresSeal: true });
    expect(reviewCommand("rm notes.txt").allowed).toBe(false);
  });

  it("keeps file listings inside the workspace", () => {
    expect(reviewCommand("ls /Users").allowed).toBe(false);
    expect(reviewCommand("ls ../../").allowed).toBe(false);
    expect(reviewCommand("ls src").allowed).toBe(true);
  });
});
