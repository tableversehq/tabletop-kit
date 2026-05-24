import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { DiscoveryState } from "./discovery-state.ts";
import type { TTKitClient, TTKitGame } from "./types.ts";

export interface TTKitContextValue {
  client: TTKitClient<TTKitGame>;
  discovery: DiscoveryState;
}

export const TTKitContext = createContext<TTKitContextValue | null>(null);

export interface TTKitProviderProps<G extends TTKitGame = TTKitGame> {
  client: TTKitClient<G>;
  children: ReactNode;
}

export function TTKitProvider<G extends TTKitGame = TTKitGame>({
  client,
  children,
}: TTKitProviderProps<G>): ReactNode {
  const value = useMemo<TTKitContextValue>(
    () => ({
      client: client as TTKitClient<TTKitGame>,
      // DiscoveryState is intentionally non-generic — it works against the
      // structural payload/result shapes that all games conform to at
      // runtime. The widening cast is localized to this one site.
      discovery: new DiscoveryState(client as never),
    }),
    [client],
  );

  useEffect(() => {
    return () => {
      client.dispose();
    };
  }, [client]);

  return (
    <TTKitContext.Provider value={value}>{children}</TTKitContext.Provider>
  );
}

export function useTTKitContext(): TTKitContextValue {
  const value = useContext(TTKitContext);
  if (value === null) {
    throw new Error(
      "useTTKitContext: no TTKitProvider in tree. Wrap your app in <TTKitProvider client={...}>.",
    );
  }
  return value;
}
