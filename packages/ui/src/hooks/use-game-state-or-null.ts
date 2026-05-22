import { useRef, useSyncExternalStore } from "react";
import { useTTKitContext } from "../client/context.tsx";
import type { RegisteredGame } from "../client/types.ts";

type View = RegisteredGame["view"];

export function useGameStateOrNull(): View | null;
export function useGameStateOrNull<T>(
  selector: (view: View) => T,
  isEqual?: (a: T, b: T) => boolean,
): T | null;
export function useGameStateOrNull<T>(
  selector?: (view: View) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T | View | null {
  const { client } = useTTKitContext();
  const cache = useRef<{ selected: T | View | null; hasValue: boolean }>({
    selected: null,
    hasValue: false,
  });

  const getSnapshot = (): T | View | null => {
    const view = client.getView();
    if (view === null) {
      if (cache.current.hasValue && cache.current.selected === null) {
        return cache.current.selected;
      }
      cache.current = { selected: null, hasValue: true };
      return null;
    }
    const next = selector ? selector(view) : view;
    if (
      cache.current.hasValue &&
      cache.current.selected !== null &&
      isEqual(cache.current.selected as T, next as T)
    ) {
      return cache.current.selected;
    }
    cache.current = { selected: next, hasValue: true };
    return next;
  };

  return useSyncExternalStore(client.subscribe.bind(client), getSnapshot);
}
