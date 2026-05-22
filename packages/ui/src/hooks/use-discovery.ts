import { useMemo, useSyncExternalStore } from "react";
import { useTTKitContext } from "../client/context.tsx";
import type {
  DiscoveryOption,
  DiscoveryPayloadShape,
  DiscoveryStateSnapshot,
  DiscoveryStatus,
  OpenDiscoveryResult,
} from "../client/discovery-state.ts";
import type { RegisteredGame, TTKitGame } from "../client/types.ts";

/**
 * Resolves to the open-discovery variant from the customer's typed result
 * union when augmented; falls back to the structural shape otherwise.
 */
type OpenResultOf<G extends TTKitGame> =
  Extract<G["discovery"]["result"], { complete: false }> extends never
    ? OpenDiscoveryResult
    : Extract<G["discovery"]["result"], { complete: false }>;

type PickOptionOf<G extends TTKitGame> =
  OpenResultOf<G> extends { options: ReadonlyArray<infer O> }
    ? O
    : DiscoveryOption;

type CompleteResultOf<G extends TTKitGame> =
  Extract<G["discovery"]["result"], { complete: true }> extends never
    ? { complete: true; input: Record<string, unknown> }
    : Extract<G["discovery"]["result"], { complete: true }>;

type CommandInputOf<G extends TTKitGame> =
  CompleteResultOf<G> extends { input: infer I } ? I : Record<string, unknown>;

type DiscoveryPayloadOf<G extends TTKitGame> =
  G["discovery"]["payload"] extends Record<string, unknown> | { type: string }
    ? G["discovery"]["payload"]
    : DiscoveryPayloadShape;

type RegisteredOpenResult = OpenResultOf<RegisteredGame>;
type RegisteredPickOption = PickOptionOf<RegisteredGame>;
type RegisteredCommandInput = CommandInputOf<RegisteredGame>;
type RegisteredDiscoveryPayload = DiscoveryPayloadOf<RegisteredGame>;

export interface UseDiscoveryResult {
  activeCommandType: string | null;
  open: RegisteredOpenResult | null;
  trail: ReadonlyArray<RegisteredPickOption>;
  pendingInput: RegisteredCommandInput | null;
  status: DiscoveryStatus;
  error: string | null;
  start: (payload: RegisteredDiscoveryPayload) => void;
  pick: (option: RegisteredPickOption) => void;
  confirm: () => void;
  cancel: () => void;
}

export function useDiscovery(): UseDiscoveryResult {
  const { discovery } = useTTKitContext();

  // Snapshot is a structural DiscoveryStateSnapshot at runtime; we expose
  // the per-game typed view at the hook boundary. The fields hold the same
  // runtime values regardless of typing, so this is a widening view-only
  // reinterpretation, not a runtime conversion.
  const snapshot = useSyncExternalStore(
    discovery.subscribe.bind(discovery),
    discovery.getSnapshot.bind(discovery),
  ) as DiscoveryStateSnapshot as unknown as TypedSnapshot;

  const actions = useMemo<DiscoveryActions>(
    () => ({
      start: discovery.start.bind(discovery) as DiscoveryActions["start"],
      pick: discovery.pick.bind(discovery) as DiscoveryActions["pick"],
      confirm: discovery.confirm.bind(discovery),
      cancel: discovery.cancel.bind(discovery),
    }),
    [discovery],
  );

  return { ...snapshot, ...actions };
}

type TypedSnapshot = Omit<UseDiscoveryResult, keyof DiscoveryActions>;
type DiscoveryActions = Pick<
  UseDiscoveryResult,
  "start" | "pick" | "confirm" | "cancel"
>;
