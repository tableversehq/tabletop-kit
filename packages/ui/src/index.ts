export { TTKitProvider } from "./client/context.tsx";
export {
  DiscoveryState,
  type CompleteDiscoveryResult,
  type DiscoveryStateSnapshot,
  type DiscoveryStatus,
  type OpenDiscoveryResult,
} from "./client/discovery-state.ts";
export type {
  CommandPayload,
  DiscoveryPayload,
  DiscoveryResult,
  ExecutionResult,
  RegisteredGame,
  TTKitClient,
  TTKitGame,
  TTKitGameRegistry,
} from "./client/types.ts";

export {
  useDiscovery,
  type UseDiscoveryResult,
} from "./hooks/use-discovery.ts";
export {
  useGameEvents,
  type UseGameEventsOptions,
} from "./hooks/use-game-events.ts";
export { useGameState } from "./hooks/use-game-state.ts";
export { useGameStateOrNull } from "./hooks/use-game-state-or-null.ts";
export {
  useSelectable,
  type SelectableState,
  type UseSelectableResult,
} from "./hooks/use-selectable.ts";
export { useTTKitClient } from "./hooks/use-ttkit-client.ts";
export { useViewerId } from "./hooks/use-viewer-id.ts";

export {
  createInProcessClient,
  type CreateInProcessClientOptions,
  type InProcessClient,
} from "./adapters/in-process.ts";
