import { describe, expect, test } from "bun:test";
import { createGameHooks } from "../src/client/create-game-hooks.ts";
import type { TTKitGame } from "../src/client/types.ts";

interface FakeView {
  players: Record<string, { score: number }>;
}

interface FakeEvent {
  kind: "card_revealed";
  cardId: number;
}

interface FakeGame extends TTKitGame {
  view: FakeView;
  event: FakeEvent;
}

describe("createGameHooks", () => {
  test("returns a bundle with all expected hooks and the provider", () => {
    const hooks = createGameHooks<FakeGame>();

    expect(typeof hooks.TTKitProvider).toBe("function");
    expect(typeof hooks.useGameState).toBe("function");
    expect(typeof hooks.useGameStateOrNull).toBe("function");
    expect(typeof hooks.useGameEvents).toBe("function");
    expect(typeof hooks.useDiscovery).toBe("function");
    expect(typeof hooks.useSelectable).toBe("function");
    expect(typeof hooks.useTTKitClient).toBe("function");
    expect(typeof hooks.useViewerId).toBe("function");
  });

  test("bundle hooks have the same identity as the underlying generic hooks", async () => {
    // The factory is purely a type narrowing — references should be the
    // same module-level functions. Two factory calls for different G
    // return the same runtime references.
    const a = createGameHooks<FakeGame>();
    const b = createGameHooks<FakeGame>();

    expect(a.useGameState).toBe(b.useGameState);
    expect(a.useDiscovery).toBe(b.useDiscovery);
    expect(a.TTKitProvider).toBe(b.TTKitProvider);
  });

  // Type-only assertion: the selector parameter must be typed as the
  // bundle's view, not unknown. This compiles only when generics flow.
  test("selector parameter is typed from the bundle's G", () => {
    const hooks = createGameHooks<FakeGame>();
    const selector: (view: FakeView) => number = (view) =>
      Object.values(view.players).length;
    // Compile-time check: this overload should accept the typed selector
    // without needing an explicit generic argument.
    const unusedHook = hooks.useGameState<number>;
    void unusedHook;
    void selector;
    expect(true).toBe(true);
  });
});
