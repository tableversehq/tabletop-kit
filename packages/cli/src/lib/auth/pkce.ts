import { createHash, randomBytes } from "node:crypto";

export interface PkceValues {
  verifier: string;
  challenge: string;
  state: string;
}

function base64Url(input: Buffer): string {
  return input.toString("base64url");
}

export function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

export function deriveCodeChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function generateState(): string {
  return base64Url(randomBytes(16));
}

export type PkceGenerator = () => PkceValues;

export const defaultPkce: PkceGenerator = () => {
  const verifier = generateCodeVerifier();

  return {
    verifier,
    challenge: deriveCodeChallenge(verifier),
    state: generateState(),
  };
};
