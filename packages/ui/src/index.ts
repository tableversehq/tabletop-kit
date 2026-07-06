export {
  createGameHooks,
  type GameHooks,
  type SelectableState,
  type TableverseProviderProps,
  type UseDiscoveryResult,
  type UseGameEventsOptions,
  type UseSelectableResult,
} from "./client/create-game-hooks.tsx";
export type { DiscoveryStatus } from "./client/discovery-state.ts";
export type {
  CommandPayload,
  DiscoveryPayload,
  DiscoveryResult,
  ExecutionResult,
  TableverseClient,
  TableverseGame,
} from "./client/types.ts";

export {
  createInProcessClient,
  type CreateInProcessClientOptions,
  type InProcessClient,
} from "./adapters/in-process.ts";
