import type { Account } from "./auth/token-store.ts";

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  /** Lifetime of the access token in seconds. */
  expiresIn: number;
}

export interface PlatformClient {
  exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<TokenResponse>;
  refreshToken(input: { refreshToken: string }): Promise<TokenResponse>;
  logout(input: { refreshToken: string }): Promise<void>;
  me(input: { accessToken: string }): Promise<Account>;
}

export type FetchLike = typeof fetch;

export class PlatformRequestError extends Error {
  readonly status: number;
  readonly endpoint: string;

  // Fields are assigned rather than declared as constructor parameter
  // properties: those are TypeScript-only syntax that Node's type stripping
  // cannot transform, and `bin` points straight at the TypeScript entry.
  constructor(status: number, endpoint: string) {
    super(`platform_request_failed:${endpoint}:${status}`);
    this.name = "PlatformRequestError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function toTokenResponse(raw: RawTokenResponse): TokenResponse {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresIn: raw.expires_in,
  };
}

export function createPlatformClient(options: {
  apiBaseUrl: string;
  clientId: string;
  fetch: FetchLike;
}): PlatformClient {
  const { apiBaseUrl, clientId, fetch: fetchImpl } = options;

  async function postToken(
    body: Record<string, string>,
  ): Promise<TokenResponse> {
    const endpoint = "/oauth/token";
    const response = await fetchImpl(`${apiBaseUrl}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, client_id: clientId }),
    });

    if (!response.ok) {
      throw new PlatformRequestError(response.status, endpoint);
    }

    return toTokenResponse((await response.json()) as RawTokenResponse);
  }

  return {
    exchangeAuthorizationCode({ code, codeVerifier, redirectUri }) {
      return postToken({
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      });
    },

    refreshToken({ refreshToken }) {
      return postToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
    },

    async logout({ refreshToken }) {
      const endpoint = "/auth/logout";
      const response = await fetchImpl(`${apiBaseUrl}${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new PlatformRequestError(response.status, endpoint);
      }
    },

    async me({ accessToken }) {
      const endpoint = "/me";
      const response = await fetchImpl(`${apiBaseUrl}${endpoint}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new PlatformRequestError(response.status, endpoint);
      }

      return (await response.json()) as Account;
    },
  };
}
