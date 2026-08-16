import { describe, expect, it } from "vitest";
import { isAllowedLocalOrigin, isAllowedLoopbackHost } from "./request-boundary";

describe("local API request boundary", () => {
  it("accepts only loopback Host headers for the configured API port", () => {
    expect(isAllowedLoopbackHost("127.0.0.1:8787", 8787)).toBe(true);
    expect(isAllowedLoopbackHost("localhost:8787", 8787)).toBe(true);
    expect(isAllowedLoopbackHost("127.0.0.1", 8787)).toBe(true);
    expect(isAllowedLoopbackHost("localhost", 8787)).toBe(true);

    expect(isAllowedLoopbackHost("evil.example:8787", 8787)).toBe(false);
    expect(isAllowedLoopbackHost("127.0.0.1.evil.example:8787", 8787)).toBe(false);
    expect(isAllowedLoopbackHost("localhost.evil.example:8787", 8787)).toBe(false);
    expect(isAllowedLoopbackHost(undefined, 8787)).toBe(false);
  });

  it("accepts absent or loopback browser origins and rejects external origins", () => {
    expect(isAllowedLocalOrigin(undefined)).toBe(true);
    expect(isAllowedLocalOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(isAllowedLocalOrigin("http://localhost:4173")).toBe(true);
    expect(isAllowedLocalOrigin("https://localhost:5173")).toBe(true);

    expect(isAllowedLocalOrigin("https://example.com")).toBe(false);
    expect(isAllowedLocalOrigin("https://localhost.example.com")).toBe(false);
    expect(isAllowedLocalOrigin("not-an-origin")).toBe(false);
  });
});
