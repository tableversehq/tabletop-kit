import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  defaultPkce,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../../src/lib/auth/pkce.ts";

describe("pkce", () => {
  it("derives an S256 challenge as base64url of the verifier's SHA-256", () => {
    const verifier = "test-verifier";
    const expected = createHash("sha256")
      .update(verifier)
      .digest()
      .toString("base64url");

    expect(deriveCodeChallenge(verifier)).toBe(expected);
  });

  it("generates url-safe values without padding", () => {
    for (const value of [
      generateCodeVerifier(),
      generateState(),
      deriveCodeChallenge("abc"),
    ]) {
      expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("produces a fresh verifier/challenge/state each call", () => {
    const first = defaultPkce();
    const second = defaultPkce();

    expect(first.verifier).not.toBe(second.verifier);
    expect(first.state).not.toBe(second.state);
    expect(first.challenge).toBe(deriveCodeChallenge(first.verifier));
  });
});
