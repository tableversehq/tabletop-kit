import { Type, type Static } from "@sinclair/typebox";

/**
 * `GET /me` — the authenticated user's profile. Used by `tvk whoami` and by
 * `tvk login` to name the account it just signed in.
 */
export const MeResponseSchema = Type.Object({
  id: Type.String(),
  /**
   * Null when no account backing this user carries an email — an OAuth provider
   * that withheld it. The platform has always allowed this.
   */
  email: Type.Union([Type.String(), Type.Null()]),
});

export type MeResponse = Static<typeof MeResponseSchema>;
