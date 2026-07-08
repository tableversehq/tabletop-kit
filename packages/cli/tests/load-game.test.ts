import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerationContext } from "../src/lib/generation-context.ts";
import { loadConfig } from "../src/lib/load-config.ts";
import { parseCommandArguments } from "../src/lib/parse-args.ts";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(currentDir, "..", "..", "..");

describe("createGenerationContext", () => {
  it("resolves the output directory from a default config file", async () => {
    const parsed = parseCommandArguments([]);

    const context = await createGenerationContext(parsed, {
      cwd: resolve(currentDir, "fixtures"),
    });

    expect(context.game.name).toBe("fixture-default");
    expect(context.outputDirectory).toBe(
      resolve(currentDir, "fixtures", "generated-from-config"),
    );
  });

  it("resolves the output directory from an explicit config file", async () => {
    const parsed = parseCommandArguments([
      "--config",
      resolve(currentDir, "fixtures", "tableverse.custom.config.ts"),
    ]);

    const context = await createGenerationContext(parsed, {
      cwd: repoRoot,
    });

    expect(context.game.name).toBe("fixture-named");
    expect(context.outputDirectory).toBe(
      resolve(currentDir, "fixtures", "custom-generated"),
    );
  });
});

describe("loadConfig", () => {
  it("loads the default tableverse.config.ts from cwd", async () => {
    const config = await loadConfig({
      cwd: resolve(currentDir, "fixtures"),
    });

    expect(config.game.name).toBe("fixture-default");
  });

  it("loads an explicit config file from --config", async () => {
    const config = await loadConfig({
      cwd: repoRoot,
      configPath: resolve(
        currentDir,
        "fixtures",
        "tableverse.custom.config.ts",
      ),
    });

    expect(config.game.name).toBe("fixture-named");
  });

  it("rejects invalid config files", async () => {
    await expect(
      loadConfig({
        cwd: repoRoot,
        configPath: resolve(
          currentDir,
          "fixtures",
          "tabletop.invalid.config.ts",
        ),
      }),
    ).rejects.toThrow("invalid_cli_config");
  });
});
