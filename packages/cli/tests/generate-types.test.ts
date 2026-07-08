import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../src/main.ts";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(currentDir, "..", "..", "..");
const splendorRoot = join(repoRoot, "examples", "splendor", "engine");

describe("generate types", () => {
  it("writes canonical and visible type declarations for a game", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tvk-types-"));
    const result = await run(["generate", "types", "--outDir", outDir], {
      cwd: splendorRoot,
    });

    expect(result.exitCode).toBe(0);

    const canonicalTypes = await readFile(
      join(outDir, "canonical-state.generated.d.ts"),
      "utf8",
    );
    const visibleTypes = await readFile(
      join(outDir, "visible-state.generated.d.ts"),
      "utf8",
    );

    expect(canonicalTypes).toContain("export interface CanonicalState");
    expect(canonicalTypes).toContain("game:");
    expect(canonicalTypes).toContain("runtime:");

    expect(visibleTypes).toContain("export interface VisibleState");
    expect(visibleTypes).toContain("game:");
    expect(visibleTypes).toContain("progression:");
    expect(visibleTypes).toContain("playerOrder");
  });
});
