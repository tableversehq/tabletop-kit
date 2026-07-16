import { describe, expect, it } from "vitest";
import { resolveOpenCommand } from "../src/lib/browser.ts";

describe("resolveOpenCommand", () => {
  const URL = "https://dev.tableverse.io/authorize";

  it("uses the platform opener when BROWSER is unset", () => {
    expect(resolveOpenCommand(URL, "linux", {})).toEqual({
      command: "xdg-open",
      args: [URL],
    });
    expect(resolveOpenCommand(URL, "darwin", {})).toEqual({
      command: "open",
      args: [URL],
    });
    expect(resolveOpenCommand(URL, "win32", {})).toEqual({
      command: "cmd",
      args: ["/c", "start", "", URL],
    });
  });

  it("honors BROWSER so the login redirect is not stuck with the system default", () => {
    expect(
      resolveOpenCommand(URL, "linux", { BROWSER: "google-chrome" }),
    ).toEqual({ command: "google-chrome", args: [URL] });
  });

  it("honors BROWSER on every platform, not just linux", () => {
    expect(
      resolveOpenCommand(URL, "darwin", { BROWSER: "google-chrome" }),
    ).toEqual({ command: "google-chrome", args: [URL] });
  });

  it("ignores a blank BROWSER rather than trying to spawn it", () => {
    expect(resolveOpenCommand(URL, "linux", { BROWSER: "   " })).toEqual({
      command: "xdg-open",
      args: [URL],
    });
  });
});
