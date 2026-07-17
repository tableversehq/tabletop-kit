import { spawn } from "node:child_process";

export type BrowserOpener = (url: string) => Promise<void>;

/**
 * Opens `url` in the user's default browser. Best-effort: it detaches the child
 * process and does not wait for the browser to exit.
 */
export const openBrowser: BrowserOpener = async (url) => {
  const { command, args } = resolveOpenCommand(url, process.platform);

  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true,
  });

  // The opener can be missing entirely (no `xdg-open` on a minimal desktop).
  // `spawn` reports that by emitting 'error' on a later tick, once this promise
  // has already resolved — too late for a caller's `.catch()` — and an 'error'
  // event with no listener is thrown, taking the whole CLI down mid-login.
  // Swallow it: opening the browser is best-effort, and the caller prints the
  // URL to visit either way.
  child.on("error", () => {});

  child.unref();
};

/**
 * Picks the command that opens `url`, deferring to the platform's default
 * handler for https. Choosing a specific browser is deliberately not supported:
 * the caller prints the URL to visit, which already lets the user open it in
 * whatever browser or profile they want — including one they are signed into a
 * different account with, which is the only reason `login` would care.
 */
export function resolveOpenCommand(
  url: string,
  platform: NodeJS.Platform,
): { command: string; args: string[] } {
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (platform === "win32") {
    // The empty "" is the window title argument that `start` expects first.
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}
