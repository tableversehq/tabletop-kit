import { expect, test } from "vitest";
import * as packageExports from "../src/index";

test("package root exports an object", () => {
  expect(packageExports).toBeTypeOf("object");
  expect(packageExports.GameDefinitionBuilder).toBeDefined();
  expect("defineGame" in packageExports).toBe(false);
  expect(packageExports.createGameExecutor).toBeDefined();
});
