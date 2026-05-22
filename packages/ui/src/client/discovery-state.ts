import type {
  CommandDiscoveryResult,
  DiscoveryStepOption,
} from "@tabletop-kit/engine";
import type {
  CommandPayload,
  DiscoveryPayload,
  TTKitClient,
  TTKitGame,
} from "./types.ts";

export type DiscoveryStatus =
  | "idle"
  | "discovering"
  | "ready_to_confirm"
  | "executing"
  | "error";

/** Open variant of the engine's discovery result — more options to pick. */
export type OpenDiscoveryResult = Extract<
  CommandDiscoveryResult,
  { complete: false }
>;

/** Complete variant — discovery is done and ready to confirm. */
export type CompleteDiscoveryResult = Extract<
  CommandDiscoveryResult,
  { complete: true }
>;

export interface DiscoveryStateSnapshot {
  readonly activeCommandType: string | null;
  readonly open: OpenDiscoveryResult | null;
  readonly trail: ReadonlyArray<DiscoveryStepOption>;
  readonly pendingInput: Record<string, unknown> | null;
  readonly status: DiscoveryStatus;
  readonly error: string | null;
}

const IDLE_SNAPSHOT: DiscoveryStateSnapshot = {
  activeCommandType: null,
  open: null,
  trail: [],
  pendingInput: null,
  status: "idle",
  error: null,
};

type ClientShape = Pick<TTKitClient<TTKitGame>, "discover" | "execute">;

/**
 * Pure (non-React) discovery state machine.
 *
 * Owns the "active command + accumulated picks + pending input" flow that
 * useDiscovery exposes. Drives client.discover and client.execute, surfaces
 * results through a single `subscribe`-style observer interface so the
 * React hook can plug it into useSyncExternalStore.
 */
export class DiscoveryState {
  private snapshot: DiscoveryStateSnapshot = IDLE_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private flowId = 0;

  constructor(private readonly client: ClientShape) {}

  getSnapshot(): DiscoveryStateSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(payload: DiscoveryPayload): void {
    const flow = ++this.flowId;
    this.setSnapshot({
      activeCommandType: payload.type,
      open: null,
      trail: [],
      pendingInput: null,
      status: "discovering",
      error: null,
    });
    void this.runDiscover(flow, payload);
  }

  pick(option: DiscoveryStepOption): void {
    const current = this.snapshot;
    if (
      current.status !== "discovering" ||
      current.activeCommandType === null
    ) {
      return;
    }
    const flow = ++this.flowId;
    this.setSnapshot({
      ...current,
      trail: [...current.trail, option],
      status: "discovering",
    });
    void this.runDiscover(flow, {
      type: current.activeCommandType,
      step: option.nextStep,
      input: option.nextInput,
    });
  }

  confirm(): void {
    const current = this.snapshot;
    if (
      current.status !== "ready_to_confirm" ||
      current.activeCommandType === null ||
      current.pendingInput === null
    ) {
      return;
    }
    const flow = ++this.flowId;
    const command = {
      type: current.activeCommandType,
      input: current.pendingInput,
    };
    this.setSnapshot({ ...current, status: "executing" });
    void this.runExecute(flow, command);
  }

  cancel(): void {
    this.flowId++;
    this.setSnapshot(IDLE_SNAPSHOT);
  }

  private async runDiscover(
    flow: number,
    payload: DiscoveryPayload,
  ): Promise<void> {
    try {
      const result = await this.client.discover(payload);
      if (this.flowId !== flow) return;

      if (result.complete) {
        this.setSnapshot({
          ...this.snapshot,
          open: null,
          pendingInput: result.input,
          status: "ready_to_confirm",
        });
      } else {
        this.setSnapshot({
          ...this.snapshot,
          open: result,
          status: "discovering",
        });
      }
    } catch (error) {
      if (this.flowId !== flow) return;
      this.setSnapshot({
        ...this.snapshot,
        status: "error",
        error: errorMessage(error),
      });
    }
  }

  private async runExecute(
    flow: number,
    command: CommandPayload,
  ): Promise<void> {
    try {
      const result = await this.client.execute(command);
      if (this.flowId !== flow) return;

      if (result.accepted) {
        this.setSnapshot(IDLE_SNAPSHOT);
      } else {
        this.setSnapshot({
          ...this.snapshot,
          status: "error",
          error: result.reason ?? "execution_rejected",
        });
      }
    } catch (error) {
      if (this.flowId !== flow) return;
      this.setSnapshot({
        ...this.snapshot,
        status: "error",
        error: errorMessage(error),
      });
    }
  }

  private setSnapshot(next: DiscoveryStateSnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "unknown_error";
}
