import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import type { BrowserOpener } from "../browser.ts";

export interface AuthorizeInput {
  /** Builds the platform-web authorize URL for a resolved loopback redirect. */
  buildAuthorizeUrl: (redirectUri: string) => string;
  /** The `state` value the callback must echo back. */
  expectedState: string;
}

export interface AuthorizeResult {
  code: string;
  redirectUri: string;
}

export type AuthorizeFn = (input: AuthorizeInput) => Promise<AuthorizeResult>;

export type AuthorizationFailure =
  | "denied"
  | "state_mismatch"
  | "missing_code"
  | "timed_out"
  | "listener_failed";

/**
 * A browser-authorization step that did not produce a code. Carries a `reason`
 * so callers can phrase it for a user without matching on message text.
 */
export class AuthorizationError extends Error {
  readonly reason: AuthorizationFailure;
  readonly detail?: string;

  constructor(reason: AuthorizationFailure, detail?: string) {
    super(
      detail ? `authorization_${reason}:${detail}` : `authorization_${reason}`,
    );
    this.name = "AuthorizationError";
    this.reason = reason;
    this.detail = detail;
  }
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

const CLOSE_TAB_PAGE =
  "<!doctype html><meta charset=utf-8><title>Tableverse CLI</title>" +
  '<body style="font-family:system-ui;padding:2rem">' +
  "<p>You're signed in to the Tableverse CLI. You can close this tab.</p>";

/**
 * Writes a response that closes its connection, and runs `onFlushed` once the
 * body has been sent. `Connection: close` stops the browser from holding the
 * socket open with keep-alive, which is what otherwise keeps the CLI alive.
 */
function respond(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string,
  onFlushed?: () => void,
): void {
  if (onFlushed) {
    res.on("finish", onFlushed);
  }

  res
    .writeHead(status, {
      "content-type": contentType,
      connection: "close",
    })
    .end(body);
}

function getPort(server: Server): number {
  const address = server.address() as AddressInfo | null;

  if (!address) {
    throw new AuthorizationError("listener_failed");
  }

  return address.port;
}

/**
 * Creates the default loopback `authorize` step: binds a throwaway HTTP server
 * on `127.0.0.1`, opens the browser to the authorize URL, and resolves with the
 * authorization code once the browser is redirected back to the callback.
 */
export function createLoopbackAuthorize(deps: {
  openBrowser: BrowserOpener;
  emit: (line: string) => void;
  timeoutMs?: number;
}): AuthorizeFn {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return ({ buildAuthorizeUrl, expectedState }) =>
    new Promise<AuthorizeResult>((resolve, reject) => {
      let settled = false;
      // Track open sockets so teardown can destroy any the browser leaves in
      // keep-alive; otherwise the listening handle keeps the process alive and
      // the CLI hangs after a successful login.
      const sockets = new Set<Socket>();

      const server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");

        if (url.pathname !== "/callback") {
          respond(res, 404, "text/plain", "");
          return;
        }

        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (error) {
          respond(
            res,
            400,
            "text/plain",
            `Authorization failed: ${error}`,
            () => finish(new AuthorizationError("denied", error)),
          );
          return;
        }

        if (state !== expectedState) {
          respond(res, 400, "text/plain", "State mismatch.", () =>
            finish(new AuthorizationError("state_mismatch")),
          );
          return;
        }

        if (!code) {
          respond(res, 400, "text/plain", "Missing authorization code.", () =>
            finish(new AuthorizationError("missing_code")),
          );
          return;
        }

        respond(res, 200, "text/html", CLOSE_TAB_PAGE, () =>
          finish(undefined, { code, redirectUri }),
        );
      });

      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });

      let redirectUri = "";

      const timer = setTimeout(() => {
        finish(new AuthorizationError("timed_out"));
      }, timeoutMs);
      timer.unref?.();

      function finish(error?: Error, result?: AuthorizeResult): void {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        server.close();
        for (const socket of sockets) {
          socket.destroy();
        }

        if (error) {
          reject(error);
        } else if (result) {
          resolve(result);
        }
      }

      server.on("error", (error) => finish(error));

      server.listen(0, "127.0.0.1", () => {
        // This callback runs outside the Promise executor's frame, so a throw
        // here would escape as an uncaught exception rather than rejecting.
        // Both `getPort` and the caller's `buildAuthorizeUrl` can throw.
        try {
          const port = getPort(server);
          redirectUri = `http://127.0.0.1:${port}/callback`;

          const authorizeUrl = buildAuthorizeUrl(redirectUri);
          deps.emit("Opening browser to authorize...");
          deps.emit(`If it doesn't open, visit:\n  ${authorizeUrl}`);

          deps.openBrowser(authorizeUrl).catch(() => {
            // Opening the browser is best-effort; the URL was printed above.
          });
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
}
