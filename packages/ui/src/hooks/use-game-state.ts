import { useRef, useSyncExternalStore } from "react";
import { useTTKitContext } from "../client/context.tsx";
import type { RegisteredGame } from "../client/types.ts";

type View = RegisteredGame["view"];

/**
 * Subscribe to a slice of the current view. Throws if no view is loaded yet —
 * use `useGameStateOrNull` from a wrapping component if you need to render
 * before a snapshot arrives.
 */
export function useGameState<T>(
  selector: (view: View) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const { client } = useTTKitContext();
  const cache = useRef<{ selected: T; hasValue: boolean }>({
    selected: undefined as T,
    hasValue: false,
  });

  const getSnapshot = (): T => {
    const view = client.getView();
    if (view === null) {
      throw new Error(
        "useGameState: no view loaded. Use useGameStateOrNull or render a loading state first.",
      );
    }
    const next = selector(view);
    if (cache.current.hasValue && isEqual(cache.current.selected, next)) {
      return cache.current.selected;
    }
    cache.current = { selected: next, hasValue: true };
    return next;
  };

  return useSyncExternalStore(client.subscribe.bind(client), getSnapshot);
}
