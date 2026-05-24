import type { ReactNode } from "react";
import {
  useDiscovery as baseUseDiscovery,
  type UseDiscoveryResult,
} from "../hooks/use-discovery.ts";
import {
  useGameEvents as baseUseGameEvents,
  type UseGameEventsOptions,
} from "../hooks/use-game-events.ts";
import { useGameState as baseUseGameState } from "../hooks/use-game-state.ts";
import { useGameStateOrNull as baseUseGameStateOrNull } from "../hooks/use-game-state-or-null.ts";
import {
  useSelectable as baseUseSelectable,
  type UseSelectableResult,
} from "../hooks/use-selectable.ts";
import { useTTKitClient as baseUseTTKitClient } from "../hooks/use-ttkit-client.ts";
import { useViewerId } from "../hooks/use-viewer-id.ts";
import {
  TTKitProvider as BaseTTKitProvider,
  type TTKitProviderProps,
} from "./context.tsx";
import type { TTKitClient, TTKitGame } from "./types.ts";

interface UseGameStateOrNullOf<G extends TTKitGame> {
  (): G["view"] | null;
  <TSelected>(
    selector: (view: G["view"]) => TSelected,
    isEqual?: (a: TSelected, b: TSelected) => boolean,
  ): TSelected | null;
}

export interface GameHooks<G extends TTKitGame> {
  readonly TTKitProvider: (props: TTKitProviderProps<G>) => ReactNode;
  readonly useGameState: <TSelected>(
    selector: (view: G["view"]) => TSelected,
    isEqual?: (a: TSelected, b: TSelected) => boolean,
  ) => TSelected;
  readonly useGameStateOrNull: UseGameStateOrNullOf<G>;
  readonly useGameEvents: (
    handler: (event: G["event"]) => void,
    options?: UseGameEventsOptions<G["event"]>,
  ) => void;
  readonly useDiscovery: () => UseDiscoveryResult<G>;
  readonly useSelectable: (
    slot: string,
    target: unknown,
  ) => UseSelectableResult<G>;
  readonly useTTKitClient: () => TTKitClient<G>;
  readonly useViewerId: () => string;
}

/**
 * Returns a bundle of hooks and the Provider pre-bound to the game shape
 * `G`. Devs typically do this once in their app:
 *
 * ```ts
 * // src/game-hooks.ts
 * import { createGameHooks } from "@tabletop-kit/ui";
 * import type { SplendorGame } from "./generated-types";
 *
 * export const { TTKitProvider, useGameState, useDiscovery, ... } =
 *   createGameHooks<SplendorGame>();
 * ```
 *
 * Components then import from `./game-hooks` and get fully typed hooks
 * without per-call generics. The factory does no runtime work — it
 * narrows generic type parameters on the underlying hooks; the references
 * are otherwise unchanged.
 */
export function createGameHooks<G extends TTKitGame>(): GameHooks<G> {
  return {
    TTKitProvider: BaseTTKitProvider as (
      props: TTKitProviderProps<G>,
    ) => ReactNode,
    useGameState: baseUseGameState as GameHooks<G>["useGameState"],
    useGameStateOrNull: baseUseGameStateOrNull as UseGameStateOrNullOf<G>,
    useGameEvents: baseUseGameEvents as GameHooks<G>["useGameEvents"],
    useDiscovery: baseUseDiscovery as GameHooks<G>["useDiscovery"],
    useSelectable: baseUseSelectable as GameHooks<G>["useSelectable"],
    useTTKitClient: baseUseTTKitClient as GameHooks<G>["useTTKitClient"],
    useViewerId,
  };
}
