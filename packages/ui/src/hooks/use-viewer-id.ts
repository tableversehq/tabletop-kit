import { useSyncExternalStore } from "react";
import { useTTKitContext } from "../client/context.tsx";

/**
 * The current viewer id. Re-renders when the active viewer changes —
 * e.g. when the in-process adapter rotates to the next active player
 * after a successful command (pass-and-play).
 */
export function useViewerId(): string {
  const { client } = useTTKitContext();
  return useSyncExternalStore(
    client.subscribe.bind(client),
    () => client.viewerId,
  );
}
