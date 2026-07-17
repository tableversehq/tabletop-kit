# `lib/api` — platform response schemas

One file per platform endpoint, named after the endpoint (`/me` → `me.ts`,
`/oauth/token` → `oauth-token.ts`). Each file holds the TypeBox schema for that
endpoint's response and the type inferred from it. `platform-client.ts` checks
every response against these before returning it.

## Why these exist at all

The platform's real contract lives in `@tableverse/api-contracts` in the private
platform repo, and this package cannot depend on it: it is unpublished, so a
released `@tableverse-kit/cli` could never resolve it, and it is written in zod
while this repo uses TypeBox.

These schemas are therefore a **second, independent statement** of the same wire
format. Nothing enforces that automatically — a contract test on the platform
side is what keeps them honest. Assume they can drift, because they have: `/me`
returning a null `email` was legal in the contract and rejected here, which
locked those users out of the CLI entirely.

## Rules for adding one

- **Name the file after the endpoint**, not after the type inside it.
- **Only require what the CLI actually reads.** TypeBox objects admit unknown
  properties, so a narrow schema lets the platform add fields without breaking a
  CLI that is already in someone's hands. Every required field is a promise the
  platform must keep forever.
- **Mirror the contract's names** (`MeResponse`, `OAuthTokenResponse`) so the
  two can be read side by side.
- **Never reuse these for a file format.** What the platform sends and what we
  persist are separate contracts that change for different reasons and on
  different schedules — see `StoredAccountSchema` in `auth/token-store.ts`, which
  deliberately restates the fields it stores rather than importing `MeResponse`.
