import { openBrowser } from "../browser.ts";
import {
  createPlatformClient,
  type PlatformClient,
} from "../platform-client.ts";
import {
  resolvePlatformConfig,
  type PlatformConfig,
} from "../platform-config.ts";
import {
  createLoopbackAuthorize,
  type AuthorizeFn,
} from "./loopback-authorize.ts";
import { defaultPkce, type PkceGenerator } from "./pkce.ts";
import { resolveCredentialsPath } from "./paths.ts";
import { createFileTokenStore, type TokenStore } from "./token-store.ts";

/** Every collaborator an auth command needs. Assembled in `main.ts`. */
export interface AuthContext {
  config: PlatformConfig;
  tokenStore: TokenStore;
  client: PlatformClient;
  authorize: AuthorizeFn;
  pkce: PkceGenerator;
  now: () => Date;
}

/**
 * Builds the production context. Wiring only — no I/O, so commands can build it
 * before deciding whether they even need it.
 */
export function createAuthContext(): AuthContext {
  const config = resolvePlatformConfig(process.env);
  // Interactive progress belongs to the browser flow, which is the only thing
  // that reports it; commands write their result through RunResult instead.
  const emit = (line: string) => process.stderr.write(`${line}\n`);

  return {
    config,
    now: () => new Date(),
    pkce: defaultPkce,
    tokenStore: createFileTokenStore({
      filePath: resolveCredentialsPath(process.env),
    }),
    client: createPlatformClient({
      apiBaseUrl: config.apiBaseUrl,
      clientId: config.clientId,
      fetch,
    }),
    authorize: createLoopbackAuthorize({ openBrowser, emit }),
  };
}
