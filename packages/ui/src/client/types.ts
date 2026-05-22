export interface TTKitGame {
  view: unknown;
  event: unknown;
  command: unknown;
  discovery: {
    payload: unknown;
    result: unknown;
  };
}

export interface ExecutionResult {
  accepted: boolean;
  reason?: string;
}

export interface TTKitClient<G extends TTKitGame> {
  readonly viewerId: string;

  getView(): G["view"] | null;
  getAvailableCommands(): readonly string[];
  getStateVersion(): number | null;

  subscribe(listener: () => void): () => void;
  onEvent(listener: (event: G["event"]) => void): () => void;

  discover(
    request: G["discovery"]["payload"],
  ): Promise<G["discovery"]["result"]>;
  execute(command: G["command"]): Promise<ExecutionResult>;

  dispose(): void;
}

// Empty by design: customers populate `game: <TheirGame>` via module
// augmentation. See docs/design/2026-05-19-tabletop-ui-hooks-design.md.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TTKitGameRegistry {}

type RegisteredGameOrFallback = TTKitGameRegistry extends { game: infer G }
  ? G extends TTKitGame
    ? G
    : TTKitGame
  : TTKitGame;

export type RegisteredGame = RegisteredGameOrFallback;
