import { describe, expect, it } from "vitest";
import { containsRecognizedSecret, redactSensitiveText, redactSensitiveValue } from "./redaction";

describe("shared sensitive-data redaction", () => {
  it("redacts common credential shapes without changing harmless text", () => {
    const harmless = "build completed in 420ms";
    expect(redactSensitiveText(harmless)).toBe(harmless);
    expect(containsRecognizedSecret(harmless)).toBe(false);

    const secret = "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456";
    expect(redactSensitiveText(secret)).toBe("OPENAI_API_KEY=[REDACTED]");
    expect(containsRecognizedSecret(secret)).toBe(true);
  });

  it("redacts URL userinfo, bearer tokens, private keys, JWTs, and provider tokens", () => {
    const raw = [
      "https://user:password@example.test/repo",
      "Bearer abcdefghijklmnopqrstuvwxyz123456",
      "ghp_abcdefghijklmnopqrstuvwxyz123456",
      "npm_abcdefghijklmnopqrstuvwxyz123456",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
      "-----BEGIN PRIVATE KEY-----\nabcdefghijklmnopqrstuvwxyz\n-----END PRIVATE KEY-----",
    ].join("\n");
    const redacted = redactSensitiveText(raw)!;

    for (const leaked of ["user:password", "abcdefghijklmnopqrstuvwxyz123456", "eyJhbGci", "BEGIN PRIVATE KEY"]) {
      expect(redacted).not.toContain(leaked);
    }
    expect(redacted).toContain("[REDACTED]");
    expect(redacted).toContain("[REDACTED PRIVATE KEY]");
  });

  it("recursively redacts strings inside evidence objects and arrays", () => {
    const evidence = {
      command: "git remote add origin https://ghp_abcdefghijklmnopqrstuvwxyz123456@example.test/repo",
      nested: [{ header: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456" }],
      count: 2,
    };

    expect(redactSensitiveValue(evidence)).toEqual({
      command: "git remote add origin https://[REDACTED]@example.test/repo",
      nested: [{ header: "Authorization:[REDACTED] [REDACTED]" }],
      count: 2,
    });
  });
});
