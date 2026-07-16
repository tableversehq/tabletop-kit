import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolves the path to the CLI credentials file, honoring `XDG_CONFIG_HOME` on
 * Linux/macOS and `%APPDATA%` on Windows, falling back to `~/.config`.
 */
export function resolveCredentialsPath(
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === "win32") {
    const base = env.APPDATA ?? join(homedir(), "AppData", "Roaming");

    return join(base, "tableverse", "credentials.json");
  }

  const base = env.XDG_CONFIG_HOME ?? join(homedir(), ".config");

  return join(base, "tableverse", "credentials.json");
}
