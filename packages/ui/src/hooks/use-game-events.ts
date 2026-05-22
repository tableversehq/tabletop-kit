import { useEffect, useRef } from "react";
import { useTTKitContext } from "../client/context.tsx";
import type { RegisteredGame } from "../client/types.ts";

type Event = RegisteredGame["event"];

export interface UseGameEventsOptions {
  filter?: (event: Event) => boolean;
}

/**
 * Subscribe to the client's event stream for the lifetime of the component.
 *
 * The handler ref is kept current — no stale-closure problem if the handler
 * changes between renders. Each event is delivered exactly once. Events fire
 * after `useGameState` and friends already reflect the post-event view.
 */
export function useGameEvents(
  handler: (event: Event) => void,
  options?: UseGameEventsOptions,
): void {
  const { client } = useTTKitContext();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const filterRef = useRef(options?.filter);
  filterRef.current = options?.filter;

  useEffect(() => {
    return client.onEvent((event) => {
      const filter = filterRef.current;
      if (filter && !filter(event)) return;
      handlerRef.current(event);
    });
  }, [client]);
}
