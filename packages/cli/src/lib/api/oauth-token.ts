import { Type, type Static } from "@sinclair/typebox";

/**
 * `POST /oauth/token` — both the `authorization_code` and `refresh_token`
 * grants answer with this body.
 *
 * The platform also returns `token_type: "Bearer"`. It is deliberately not
 * required here: nothing reads it, and requiring a field is a promise the
 * platform has to keep forever.
 */
export const OAuthTokenResponseSchema = Type.Object({
  access_token: Type.String(),
  refresh_token: Type.String(),
  /** Lifetime of the access token in seconds. */
  expires_in: Type.Number(),
});

export type OAuthTokenResponse = Static<typeof OAuthTokenResponseSchema>;
