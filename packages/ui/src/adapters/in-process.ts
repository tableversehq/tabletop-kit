import type { GameExecutor } from "@tabletop-kit/engine";
import type {
  CommandPayloadShape,
  DiscoveryPayloadShape,
} from "../client/discovery-state.ts";
import type {
  ExecutionResult,
  RegisteredGame,
  TTKitClient,
  TTKitGame,
} from "../client/types.ts";

interface CanonicalStateLike {
  game: object;
  runtime: object;
}

export interface CreateInProcessClientOptions<
  State extends CanonicalStateLike,
> {
  viewerId: string;
  initialState: State;
}

/**
 * In-process implementation of TTKitClient. Wraps a GameExecutor; runs the
 * engine in the same JavaScript context as the UI. All async methods resolve
 * synchronously through Promise.resolve, so single-player games never wait
 * on a network.
 *
 * The customer constructs the initial state externally (typically with
 * `executor.createInitialState(...)`) and hands it in. The adapter owns the
 * running-game phase: state mutation, subscriber notification, event fan-out.
 *
 * `G` defaults to the augmented `RegisteredGame`; `State` and `SetupInput`
 * are inferred from the `executor` and `options.initialState` arguments. In
 * the common case, no generics need to be specified at the call site.
 */
export function createInProcessClient<
  G extends TTKitGame = RegisteredGame,
  State extends CanonicalStateLike = CanonicalStateLike,
  SetupInput extends object | undefined = undefined,
>(
  executor: GameExecutor<State["game"], SetupInput>,
  options: CreateInProcessClientOptions<State>,
): TTKitClient<G> {
  let state = options.initialState as never;
  let version = 0;
  const viewer = { kind: "player" as const, playerId: options.viewerId };
  const subscribers = new Set<() => void>();
  const eventListeners = new Set<(event: G["event"]) => void>();
  let disposed = false;

  const notifySubscribers = (): void => {
    for (const listener of subscribers) listener();
  };

  const emitEvents = (events: ReadonlyArray<unknown>): void => {
    for (const event of events) {
      for (const listener of eventListeners) {
        listener(event as G["event"]);
      }
    }
  };

  const ensureLive = (): void => {
    if (disposed) {
      throw new Error("createInProcessClient: client has been disposed");
    }
  };

  return {
    viewerId: options.viewerId,

    getView() {
      if (disposed) return null;
      return executor.getView(state, viewer) as G["view"];
    },

    getAvailableCommands() {
      if (disposed) return [];
      return executor.listAvailableCommands(state, {
        actorId: options.viewerId,
      });
    },

    getStateVersion() {
      return disposed ? null : version;
    },

    subscribe(listener) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },

    onEvent(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },

    async discover(payload) {
      ensureLive();
      const { type, step, input } = payload as DiscoveryPayloadShape;
      const result = executor.discoverCommand(state, {
        type,
        actorId: options.viewerId,
        step,
        input,
      });
      if (result === null) {
        throw new Error(`discover: command "${type}" has no discovery defined`);
      }
      return result as unknown as G["discovery"]["result"];
    },

    async execute(command) {
      ensureLive();
      const { type, input } = command as CommandPayloadShape;
      const result = executor.executeCommand(state, {
        type,
        actorId: options.viewerId,
        input,
      });

      if (!result.ok) {
        return {
          accepted: false,
          reason: result.reason,
        } satisfies ExecutionResult;
      }

      state = result.state as never;
      version += 1;
      notifySubscribers();
      emitEvents(result.events);
      return { accepted: true } satisfies ExecutionResult;
    },

    dispose() {
      disposed = true;
      subscribers.clear();
      eventListeners.clear();
    },
  };
}

/**
 * Convenience: shape the executor type so callers don't have to fight
 * generics. The runtime cost is zero; this is only a type assertion helper.
 */
export type InProcessClient<G extends TTKitGame> = TTKitClient<G>;
