import { useTTKitContext } from "../client/context.tsx";
import type { RegisteredGame, TTKitClient } from "../client/types.ts";

export function useTTKitClient(): TTKitClient<RegisteredGame> {
  return useTTKitContext().client;
}
