import type { AuthContext } from "../lib/auth/context.ts";
import { describeAuthError } from "../lib/auth/error-message.ts";
import { failure, success, type RunResult } from "../lib/command-result.ts";
import { createLogoutHelpText } from "../lib/help-text.ts";
import { isHelpFlag } from "../lib/parse-args.ts";

export async function runLogoutCommand(
  args: string[],
  ctx: AuthContext,
): Promise<RunResult> {
  const [firstArg] = args;

  if (isHelpFlag(firstArg)) {
    return success(createLogoutHelpText());
  }

  if (firstArg !== undefined) {
    return failure(`unexpected_positional_argument:${firstArg}`);
  }

  try {
    // Clearing locally is the part that must happen, so do it first and take
    // the removed entry with us: one pass over the file, and no window where a
    // concurrent `login` writes an entry this rewrite would drop.
    const credentials = await ctx.tokenStore.remove(ctx.config.apiBaseUrl);

    if (!credentials) {
      return success("Already logged out.");
    }

    // Best-effort server-side revocation; the local credentials are already
    // gone, and a failure here must not turn a successful logout into an error.
    try {
      await ctx.client.logout({ refreshToken: credentials.refreshToken });
    } catch {
      // Ignore: the token may already be expired/revoked, or we may be offline.
    }

    return success("Logged out.");
  } catch (error) {
    return failure(
      describeAuthError(error, { config: ctx.config, command: "logout" }),
    );
  }
}
