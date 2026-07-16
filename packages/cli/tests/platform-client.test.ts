import { describe, expect, it, vi } from "vitest";
import {
  createPlatformClient,
  PlatformRequestError,
  type FetchLike,
} from "../src/lib/platform-client.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeClient(fetchImpl: FetchLike) {
  return createPlatformClient({
    apiBaseUrl: "https://api-dev.tableverse.io",
    clientId: "tvk-cli",
    fetch: fetchImpl,
  });
}

describe("platform client", () => {
  it("exchanges an authorization code and maps the snake_case response", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({
        access_token: "a",
        refresh_token: "r",
        expires_in: 3600,
      }),
    );

    const tokens = await makeClient(fetchImpl).exchangeAuthorizationCode({
      code: "c",
      codeVerifier: "v",
      redirectUri: "http://127.0.0.1:1/callback",
    });

    expect(tokens).toEqual({
      accessToken: "a",
      refreshToken: "r",
      expiresIn: 3600,
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api-dev.tableverse.io/oauth/token");
    expect(JSON.parse(String(init?.body))).toEqual({
      grant_type: "authorization_code",
      code: "c",
      code_verifier: "v",
      redirect_uri: "http://127.0.0.1:1/callback",
      client_id: "tvk-cli",
    });
  });

  it("posts the refresh token to /auth/logout", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));

    await makeClient(fetchImpl).logout({ refreshToken: "r" });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api-dev.tableverse.io/auth/logout");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: "r" });
  });

  it("sends the bearer token for /me", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({ id: "u1", email: "user@example.com" }),
    );

    const account = await makeClient(fetchImpl).me({ accessToken: "tok" });

    expect(account).toEqual({ id: "u1", email: "user@example.com" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api-dev.tableverse.io/me");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer tok",
    );
  });

  it("throws PlatformRequestError with the status on a non-2xx response", async () => {
    const client = makeClient(async () => jsonResponse({}, 401));

    await expect(client.me({ accessToken: "tok" })).rejects.toMatchObject({
      status: 401,
      endpoint: "/me",
    });
    await expect(client.me({ accessToken: "tok" })).rejects.toBeInstanceOf(
      PlatformRequestError,
    );
  });
});
