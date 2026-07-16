import { spawn } from "node:child_process";

export type BrowserOpener = (url: string) => Promise<void>;

/**
 * Opens `url` in the user's default browser. Best-effort: it detaches the child
 * process and does not wait for the browser to exit.
 */
export const openBrowser: BrowserOpener = async (url) => {
  const { command, args } = resolveOpenCommand(
    url,
    process.platform,
    process.env,
  );

  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true,
  });

  child.unref();
};

/**
 * Picks the command that opens `url`. `BROWSER` wins over the platform default,
 * the convention `gh` and `git web--browse` follow: without it the only way to
 * authorize in a different browser is to change the system-wide default.
 */
export function resolveOpenCommand(
  url: string,
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): { command: string; args: string[] } {
  const browser = env.BROWSER?.trim();

  if (browser) {
    return { command: browser, args: [url] };
  }

  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (platform === "win32") {
    // The empty "" is the window title argument that `start` expects first.
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}
